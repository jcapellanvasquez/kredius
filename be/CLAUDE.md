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
- The only test is a `@SpringBootTest` context-load test. It needs a reachable Postgres.
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
- Hibernate owns the schema. `ddl-auto` defaults to `create-drop` (override with `SPRING_JPA_DDL_AUTO`), and the project has no migrations.
- Every restart wipes the database. `config/DataInitializer` then re-seeds a user and a chart of accounts.
- Uniqueness and dedup rules therefore live in JPA `@Table(uniqueConstraints = …)`.

**Double-entry ledger:**
- `Account` has an `AccountType`: ASSET, LIABILITY, EQUITY, INCOME or EXPENSE. Each type owns a code range (1000s, 2000s, …; see `AccountType.codeRange`).
- A `JournalEntry` has two or more `JournalLine`s. Each line has a DEBIT/CREDIT `side`, an `originalAmount` in its own currency (RD or USD), and `amountRd` converted to RD$ with an `ExchangeRate`.
- `JournalService.ACCOUNT_NATURE` maps each account type to the side it sits on. Entries are never deleted. A reversal is a new entry with mirrored sides and `reversesEntry` set.
- `JournalSource` records the origin of each entry, and `referenceId` points back to the originating record (for example the statement import id).

**Statement import pipeline (`StatementService`):** this is the core feature. It turns BHD bank PDF statements into journal entries.
1. **Upload:** the PDF is parsed by `BhdPdfParser` (credit card) or `BhdSavingsPdfParser` (savings). Both use PDFBox with regexes over Spanish-language section headers. Rows already imported for the account are skipped (see dedup below); each new row becomes a `StatementLine`. Its category account is guessed by matching the description against `MerchantDictionary` patterns. The import is set to `PENDING_REVIEW` (`CONFIRMED` if nothing new needs review), or `FAILED` with `errorMessage` on any exception.
2. **Review:** `patchLine` sets the category account or `isExcluded` on a line. Setting a category also "learns" a merchant pattern: the part of the description before `#` or `*`.
3. **Confirm:** each non-excluded, categorized line is posted through `JournalService.saveJournalLine`. Lines that already have a `journalLine` are skipped, so confirming again never double-posts. The import becomes `CONFIRMED` only once every non-excluded line has been posted. Otherwise it stays `PENDING_REVIEW`, and you can confirm again later to post the rest.
4. **Reverse:** posts mirrored reversal entries and sets the import to `REVERSED`.

**Dedup:** a statement line is the same transaction when it has the same account, date, description, amount, currency and `occurrenceIndex`. That is the unique constraint on `statement_lines`; upload loads the account's existing keys and skips matching rows. `occurrenceIndex` tells apart identical transactions inside one statement, so re-uploading the same or a longer statement numbers them the same way.

Other domains follow the same controller/service pattern: loans (`Loan`, `LoanInstallment`, `PrincipalPayment`), income, budgets, merchant dictionary and reports.

## Conventions

- Seed data, domain labels and bank-statement text are in Spanish. Code and identifiers are in English.
- Money is `BigDecimal` with `precision = 14, scale = 2`. Never use floating point for amounts, except where the generated DTOs require `Double`.
- Kotlin `spring` and `jpa` compiler plugins handle open classes and no-arg constructors. Entities are regular classes (not data classes) with default values for every constructor parameter.
