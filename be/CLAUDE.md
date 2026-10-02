# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`be/` is the backend of Kredius, a self-hosted personal finance app built on double-entry bookkeeping. It uses Spring Boot 4.1, Kotlin 2.3 and Java 17, with JPA on PostgreSQL. The rest of the monorepo lives in sibling directories: `../ui` (Angular frontend), `../db` (Postgres image plus `init/01-init.sql`), `../docker-compose.yml` and `../k8s`.

## Commands

Run all of these from `be/`:

```bash
./mvnw generate-sources          # regenerate API interfaces/models from openapi.yaml
./mvnw spring-boot:run           # run on :8080 (Swagger UI at /swagger-ui.html, spec at /api-docs)
./mvnw package -DskipTests       # build jar
./mvnw test                      # run tests
./mvnw test -Dtest=BeApplicationTests            # single test class
./mvnw test -Dtest=BeApplicationTests#contextLoads  # single method
```

- To start a local database, run `docker compose up postgres` from the repo root. The datasource defaults to `jdbc:postgresql://10.0.0.49:5432/kredius`, so point it at localhost with `SPRING_DATASOURCE_URL`.
- The unit tests (parsers and services, with Mockito) need no database: run them with `./mvnw test -Dtest='!BeApplicationTests' -Dsurefire.failIfNoSpecifiedTests=false`.
- `BeApplicationTests` is a `@SpringBootTest` context-load test. It needs a reachable Postgres, runs the Flyway migrations on whatever database it points at, and validates the entities against it.
- The project has no linter or formatter configured.

## OpenAPI-first workflow

`src/main/resources/api/openapi.yaml` is the source of truth for the HTTP API. The `openapi-generator-maven-plugin` (`kotlin-spring`, `interfaceOnly`, `useTags`) generates code into `target/generated-sources/openapi/`:
- `com.kredius.be.api.*Api`: Spring MVC interfaces, one per tag.
- `com.kredius.be.model.*`: request and response DTOs.

To change an endpoint:
1. Edit the spec.
2. Regenerate the code.
3. Implement the generated interface in `controller/`.

Never hand-edit generated code. Controllers stay thin and delegate to `service/`. Services map entities to the generated DTOs themselves (for example the `toResponse()`/`toDto()` extension functions in `StatementService`).

Entity enums and API enums often share names. When both are needed in one file, disambiguate them with import aliases (`import com.kredius.be.model.StatementType as ApiStatementType`).

## Architecture

**Layers:** `controller` → `service` → `repository` (Spring Data JPA) → `entity`. PDF parsing lives in `parser/`. Errors go through `exception/GlobalExceptionHandler`:
- Throw `ApiException(code, message, httpStatus)` for API errors. It is rendered as the generated `ErrorResponse`.

**Multi-tenancy by Hibernate filter:**
- Entities carry `@Filter(name = "userFilter", condition = "user_id = :userId")`. The `@FilterDef` is declared on `Account`.
- `UserFilterInterceptor` enables the filter on every request. It is registered in `WebConfig` with `order(Int.MAX_VALUE)` so the Hibernate session already exists when it runs.
- Authentication does not exist yet. `CurrentUserService` resolves a fixed user from `default-session-user-id` in `application.properties`.
- Repositories still scope queries explicitly (`findByIdAndUserId`, etc.). Keep doing that; don't rely on the filter alone.

**Schema:**
- Flyway owns the schema: versioned SQL in `src/main/resources/db/migration`, applied at startup and recorded in `flyway_schema_history`. Hibernate runs with `ddl-auto: validate`: it only checks that entities match the tables and fails startup when they don't.
- **Entity change ⇒ a new `V<n>__<what_in_snake_case>.sql` in the same commit.** Never edit a migration that has run anywhere (Flyway checks checksums); write a new one. A `NOT NULL` column on a table with rows is add nullable → backfill → `SET NOT NULL`. Renames use `RENAME COLUMN`, so data is kept.
- Enum columns are plain `varchar` with no CHECK constraint, so a new enum value needs no migration.
- Restarts keep the data. `config/DataInitializer` seeds a user and a chart of accounts only when it finds no rows. To start over locally, empty the schema (`docker compose down -v && docker compose up -d postgres`, or `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); Flyway refuses a non-empty schema that has no `flyway_schema_history`.
- Uniqueness and dedup rules live in the migrations, mirrored in JPA `@Table(uniqueConstraints = …)`.

**Double-entry ledger:**
- `Account` has an `AccountType`: ASSET, LIABILITY, EQUITY, INCOME or EXPENSE. Each type owns a code range (1000s, 2000s, …; see `AccountType.codeRange`).
- A `JournalEntry` has two or more `JournalLine`s. Each line has a DEBIT/CREDIT `side`, an `originalAmount` in its own currency (RD or USD), and `amountRd` converted to RD$ with an `ExchangeRate`.
- `JournalService.ACCOUNT_NATURE` maps each account type to the side it sits on. Entries are never deleted. A reversal is a new entry with mirrored sides and `reversesEntry` set. `JournalEntry.correctionType` says why a non-original entry exists (`RECATEGORIZATION`, `REVERSAL`).
- `JournalSource` records the origin of each entry, and `referenceId` points back to the originating record (for example the statement import id).

**Statement import pipeline (`StatementService`):** this is the core feature. It turns BHD bank PDF statements into journal entries.
1. **Upload:** the PDF is parsed by `BhdPdfParser` (credit card) or `BhdSavingsPdfParser` (savings). Both use PDFBox with regexes over Spanish-language section headers. Rows already imported for the account are skipped (see dedup below); each new row becomes a `StatementLine`. With `kredius.statement.auto-categorize` on (env `KREDIUS_AUTO_CATEGORIZE`, **off by default**), its category account is guessed by matching the description against `MerchantDictionary` patterns, and matched lines are posted right away; off, every row waits for review. Some rows are stored but never posted, through `StatementLine.exclude(reason)`: the savings `BALANCE INICIAL` (the first statement of an account posts it once as the opening balance, Ahorros DR / Capital Inicial CR, source `OPENING_BALANCE`, and links the row to it; a card statement has no such row, so the first one posts closing balance − charges + credits of its RD$ rows), and card payment rows (`CARD_PAYMENT_AVOID_DOUBLE_ENTRY`), because the savings `PAGO DE TC` row, which the seeded dictionary maps to the card, posts the payment. The whole upload is one transaction. The import is set to `CONFIRMED` when every non-excluded line is posted, `PENDING_REVIEW` otherwise, or `FAILED` with `errorMessage` when parsing fails.
2. **Review:** `patchLine` sets the category account or excludes a line (`USER_EXCLUDED`). Setting a category on an unposted line posts it right away and also "learns" a merchant pattern (only with auto-categorize on): the part of the description before `#` or `*`. A posted line can't be changed through PATCH (409); lines of a `REVERSED` import can't be patched or confirmed.
3. **Confirm:** each non-excluded, categorized line is posted through `JournalService.saveJournalLine`. Lines that already have a `journalLine` are skipped, so confirming again never double-posts. The import becomes `CONFIRMED` only once every non-excluded line has been posted. Otherwise it stays `PENDING_REVIEW`, and you can confirm again later to post the rest.
4. **Recategorize:** `POST /statement-lines/{id}/recategorize` moves a posted line to another category. It adds a correction entry (`correctionType = RECATEGORIZATION`, dated like the original) from the current category to the new one, and never edits the original entry.
5. **Reverse:** mirrors every entry of the import (all share `referenceId = import id`, recategorizations included) with `correctionType = REVERSAL`, each dated like the entry it mirrors, and sets the import to `REVERSED`. Works on `CONFIRMED` and `PENDING_REVIEW` imports, since PATCH posts line by line.

**US$ lines:** they post only once a card rate exists (`ExchangeRate`, context `CREDIT_CARD`). Until then they stay unposted, and a PATCH with a category returns 422 `NO_EXCHANGE_RATE`. `POST /exchange-rates` saves the rate and posts the categorized US$ lines that were waiting. `amountRd()` rounds to the cent.

**Loan path:** a line whose category is a loan account (dictionary match or PATCH) doesn't post normally. `LoanService.payFromStatement` books the bank's amount against the loan's oldest pending installment (interest per schedule, the rest principal) and marks it `PAID`, or, when "Pagar" already paid it within 10 days, links the line to that entry and excludes it (`LOAN_PAYMENT_ALREADY_RECORDED`). Reversing the import reopens the installment. The savings account everywhere is the active account with `statementType = SAVINGS`.

**Budget period:** `StatementLine.budgetPeriod` and `JournalEntry.budgetPeriod` (first day of a month) say which month's budget a row counts in, separate from its real date. A card statement counts whole in its cut-off month (cut on 26/09 → 27/08–26/09 is September); everything else counts in its own month; recategorizations and reversals copy the original's. The budget screen and `GET /reports/budget` group by it; balances and ledger reports use `entryDate`. The budget screen's card block also reconciles the card's RD$ balance at the cut-off (`BudgetCardCheck`); the design is in `external-files/statament/card-billing-cycle-design.md`.

**Dedup:** a statement line is the same transaction when it has the same account, date, description, amount, currency and `occurrenceIndex`. That is the unique constraint on `statement_lines`; upload loads the account's existing keys and skips matching rows. `occurrenceIndex` tells apart identical transactions inside one statement, so re-uploading the same or a longer statement numbers them the same way.

Other domains follow the same controller/service pattern: loans (`Loan`, `LoanInstallment`, `PrincipalPayment`), income, budgets, merchant dictionary and reports.

## Conventions

- Seed data, domain labels and bank-statement text are in Spanish. Code and identifiers are in English.
- Money is `BigDecimal` with `precision = 14, scale = 2`. Never use floating point for amounts, except where the generated DTOs require `Double`.
- Kotlin `spring` and `jpa` compiler plugins handle open classes and no-arg constructors. Entities are regular classes (not data classes) with default values for every constructor parameter.
