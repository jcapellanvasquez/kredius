package com.kredius.be.config

import com.kredius.be.entity.*
import com.kredius.be.repository.*
import org.springframework.boot.CommandLineRunner
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.LocalDate

@Component
class DataInitializer(
    private val userRepo: UserRepository,
    private val accountRepo: AccountRepository,
    private val exchangeRateRepo: ExchangeRateRepository,
    private val journalEntryRepo: JournalEntryRepository,
    private val journalLineRepo: JournalLineRepository,
    private val incomeEntryRepo: IncomeEntryRepository,
    private val loanRepo: LoanRepository,
    private val loanInstallmentRepo: LoanInstallmentRepository,
    private val budgetRepo: BudgetRepository,
    private val merchantDictionaryRepo: MerchantDictionaryRepository,
) : CommandLineRunner {

    override fun run(vararg args: String) {
        // ── Users ──────────────────────────────────────────────────────
        val jcapellan = userRepo.save(User(name = "jcapellan", email = "jcapellan@kredius.local"))
        val jcapellanTest = userRepo.save(User(name = "jcapellan-test", email = "jcapellan-test@kredius.local"))

        // ── Accounts ───────────────────────────────────────────────────
        val savings = accountRepo.save(Account(user = jcapellan, code = "1020", name = "Cuenta Ahorros BHD", type = AccountType.ASSET))
        val checking = accountRepo.save(Account(user = jcapellan, code = "1030", name = "Cuenta Corriente BHD", type = AccountType.ASSET))
        val creditCard = accountRepo.save(Account(user = jcapellan, code = "2010", name = "Tarjeta de Crédito BHD", type = AccountType.LIABILITY))
        val loanGivenAccount = accountRepo.save(Account(user = jcapellan, code = "3010", name = "Préstamo Dado – Pedro Gómez", type = AccountType.ASSET))
        val loanReceivedAccount = accountRepo.save(Account(user = jcapellan, code = "3020", name = "Préstamo Recibido – Banco Popular", type = AccountType.LIABILITY))
        val equityAccount = accountRepo.save(Account(user = jcapellan, code = "3000", name = "Capital Inicial", type = AccountType.EQUITY))
        val salaryAccount = accountRepo.save(Account(user = jcapellan, code = "4010", name = "Salario", type = AccountType.INCOME))
        val superAccount = accountRepo.save(Account(
            user = jcapellan, code = "5010", name = "Supermercado", type = AccountType.EXPENSE,
            thresholdPct = BigDecimal("20.00"), showInAlerts = true,
        ))
        val gasAccount = accountRepo.save(Account(
            user = jcapellan, code = "5020", name = "Gasolina", type = AccountType.EXPENSE,
            thresholdPct = BigDecimal("10.00"), showInAlerts = true,
        ))
        val restaurantAccount = accountRepo.save(Account(
            user = jcapellan, code = "5030", name = "Restaurantes", type = AccountType.EXPENSE,
            thresholdPct = BigDecimal("15.00"), showInAlerts = true,
        ))
        val servicesAccount = accountRepo.save(Account(
            user = jcapellan, code = "5040", name = "Servicios", type = AccountType.EXPENSE,
            thresholdPct = BigDecimal("10.00"), showInAlerts = false,
        ))
        val financialExpenseAccount = accountRepo.save(Account(
            user = jcapellan, code = "5050", name = "Gastos Financieros", type = AccountType.EXPENSE,
        ))

        // ── Exchange rates ─────────────────────────────────────────────
        val payrollRate = exchangeRateRepo.save(ExchangeRate(
            rateDate = LocalDate.of(2026, 9, 1),
            context = RateContext.PAYROLL,
            value = BigDecimal("60.50"),
        ))
        exchangeRateRepo.save(ExchangeRate(
            rateDate = LocalDate.of(2026, 9, 1),
            context = RateContext.CREDIT_CARD,
            value = BigDecimal("61.00"),
        ))

        // ── Opening balance journal entry ──────────────────────────────
        val openingEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 1, 1),
            description = "Saldos iniciales",
            source = JournalSource.OPENING_BALANCE,
            user = jcapellan,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = openingEntry, account = savings,    side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("200000"), amountRd = bd("200000")),
            JournalLine(journalEntry = openingEntry, account = checking,   side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("50000"),  amountRd = bd("50000")),
            JournalLine(journalEntry = openingEntry, account = equityAccount, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = bd("250000"), amountRd = bd("250000")),
        ))

        // ── Payroll income (Sep 2026) ──────────────────────────────────
        // US$1,500 @ 60.50 = RD$90,750
        val payrollEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 9, 15),
            description = "Nómina septiembre 2026",
            source = JournalSource.INCOME,
            user = jcapellan,
        ))
        val payrollAmount = bd("90750")
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = payrollEntry, account = savings,      side = EntrySide.DEBIT,  currency = CurrencyType.USD, originalAmount = bd("1500"), exchangeRate = payrollRate, amountRd = payrollAmount),
            JournalLine(journalEntry = payrollEntry, account = salaryAccount, side = EntrySide.CREDIT, currency = CurrencyType.USD, originalAmount = bd("1500"), exchangeRate = payrollRate, amountRd = payrollAmount),
        ))
        incomeEntryRepo.save(IncomeEntry(
            destinationAccount = savings,
            source = "payroll",
            currency = CurrencyType.USD,
            originalAmount = bd("1500"),
            exchangeRate = payrollRate,
            bankFee = bd("0"),
            entryDate = LocalDate.of(2026, 9, 15),
            journalEntry = payrollEntry,
        ))

        // ── Loan given: Pedro Gómez ────────────────────────────────────
        // Principal 50,000 RD$, 15% add-on, 10 weekly installments
        // Total = 50,000 * 1.15 = 57,500; installment = 5,750
        val givenPrincipal = bd("50000")
        val givenTotal = bd("57500")
        val givenInstallment = bd("5750")
        val givenStartDate = LocalDate.of(2026, 8, 1)

        val loanGivenDisbursement = journalEntryRepo.save(JournalEntry(
            entryDate = givenStartDate,
            description = "Préstamo otorgado – Pedro Gómez",
            source = JournalSource.LOAN,
            user = jcapellan,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = loanGivenDisbursement, account = loanGivenAccount, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = givenPrincipal, amountRd = givenPrincipal),
            JournalLine(journalEntry = loanGivenDisbursement, account = savings,          side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = givenPrincipal, amountRd = givenPrincipal),
        ))

        val loanGiven = loanRepo.save(Loan(
            account = loanGivenAccount,
            type = LoanType.GIVEN,
            counterpartyName = "Pedro Gómez",
            principal = givenPrincipal,
            rate = bd("15.000"),
            frequency = LoanFrequency.WEEKLY,
            numInstallments = 10,
            installmentAmount = givenInstallment,
            startDate = givenStartDate,
            user = jcapellan,
        ))

        // Generate 10 weekly installments; first 3 are paid
        repeat(10) { i ->
            val num = i + 1
            val date = givenStartDate.plusWeeks(num.toLong())
            val amount = if (num == 10) givenTotal - givenInstallment * bd("9") else givenInstallment
            val paid = num <= 3
            val installmentEntry = if (paid) journalEntryRepo.save(JournalEntry(
                entryDate = date, description = "Cuota #$num – Pedro Gómez",
                source = JournalSource.LOAN, referenceId = loanGiven.id, user = jcapellan,
            )) else null
            if (installmentEntry != null) {
                journalLineRepo.saveAll(listOf(
                    JournalLine(journalEntry = installmentEntry, account = savings,          side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = amount, amountRd = amount),
                    JournalLine(journalEntry = installmentEntry, account = loanGivenAccount, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = amount, amountRd = amount),
                ))
            }
            loanInstallmentRepo.save(LoanInstallment(
                loan = loanGiven,
                number = num,
                scheduledDate = date,
                scheduledAmount = amount,
                status = if (paid) InstallmentStatus.PAID else InstallmentStatus.PENDING,
                actualPaymentDate = if (paid) date else null,
                journalEntry = installmentEntry,
            ))
        }

        // ── Loan received: Banco Popular ───────────────────────────────
        // Principal 500,000 RD$, 12% annual declining balance, 24 monthly installments
        // PMT ≈ 23,537 RD$
        val recvPrincipal = bd("500000")
        val annualRate = bd("0.12")
        val monthlyRate = annualRate.divide(bd("12"), 10, RoundingMode.HALF_UP)
        val n = 24
        val pmt = calculatePmt(recvPrincipal, monthlyRate, n)
        val recvStartDate = LocalDate.of(2026, 1, 1)

        val loanReceivedDisbursement = journalEntryRepo.save(JournalEntry(
            entryDate = recvStartDate,
            description = "Préstamo recibido – Banco Popular",
            source = JournalSource.LOAN,
            user = jcapellan,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = loanReceivedDisbursement, account = savings,            side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = recvPrincipal, amountRd = recvPrincipal),
            JournalLine(journalEntry = loanReceivedDisbursement, account = loanReceivedAccount, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = recvPrincipal, amountRd = recvPrincipal),
        ))

        val loanReceived = loanRepo.save(Loan(
            account = loanReceivedAccount,
            type = LoanType.RECEIVED,
            counterpartyName = "Banco Popular",
            principal = recvPrincipal,
            rate = bd("12.000"),
            frequency = LoanFrequency.MONTHLY,
            numInstallments = n,
            installmentAmount = pmt.setScale(2, RoundingMode.HALF_UP),
            startDate = recvStartDate,
            user = jcapellan,
        ))

        var balance = recvPrincipal
        repeat(n) { i ->
            val num = i + 1
            val date = recvStartDate.plusMonths(num.toLong())
            val interest = balance.multiply(monthlyRate).setScale(2, RoundingMode.HALF_UP)
            val principal = pmt.subtract(interest).setScale(2, RoundingMode.HALF_UP)
            val amount = if (num == n) balance.add(interest) else pmt.setScale(2, RoundingMode.HALF_UP)
            val paid = date.isBefore(LocalDate.of(2026, 9, 1)) // Jan–Aug 2026 paid
            val installmentEntry = if (paid) journalEntryRepo.save(JournalEntry(
                entryDate = date, description = "Cuota #$num – Banco Popular",
                source = JournalSource.LOAN, referenceId = loanReceived.id, user = jcapellan,
            )) else null
            if (installmentEntry != null) {
                journalLineRepo.saveAll(listOf(
                    JournalLine(journalEntry = installmentEntry, account = loanReceivedAccount,    side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = principal, amountRd = principal),
                    JournalLine(journalEntry = installmentEntry, account = financialExpenseAccount, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = interest,  amountRd = interest),
                    JournalLine(journalEntry = installmentEntry, account = savings,                side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = amount,    amountRd = amount),
                ))
            }
            loanInstallmentRepo.save(LoanInstallment(
                loan = loanReceived,
                number = num,
                scheduledDate = date,
                scheduledAmount = amount,
                scheduledInterest = interest,
                scheduledPrincipal = principal,
                status = if (paid) InstallmentStatus.PAID else InstallmentStatus.PENDING,
                actualPaymentDate = if (paid) date else null,
                journalEntry = installmentEntry,
            ))
            balance = balance.subtract(principal)
        }

        // ── Budgets (September 2026) ───────────────────────────────────
        val sep = LocalDate.of(2026, 9, 1)
        listOf(
            superAccount      to bd("25000"),
            gasAccount        to bd("8000"),
            restaurantAccount to bd("12000"),
            servicesAccount   to bd("10000"),
        ).forEach { (account, amount) ->
            budgetRepo.save(Budget(account = account, period = sep, amount = amount, origin = BudgetOrigin.MANUAL))
        }

        // ── Merchant dictionary ────────────────────────────────────────
        listOf(
            "SM Nacional"   to superAccount,
            "La Sirena"     to superAccount,
            "Shell"         to gasAccount,
            "Esso"          to gasAccount,
            "Isla"          to gasAccount,
            "Claro"         to servicesAccount,
            "Altice"        to servicesAccount,
        ).forEach { (pattern, account) ->
            merchantDictionaryRepo.save(MerchantDictionary(textPattern = pattern, account = account, user = jcapellan))
        }

        // ══════════════════════════════════════════════════════════════════
        // jcapellan-test — isolated test data
        // ══════════════════════════════════════════════════════════════════

        // ── Accounts ───────────────────────────────────────────────────
        val tSavings        = accountRepo.save(Account(user = jcapellanTest, code = "1020", name = "Cuenta Ahorros BHD", type = AccountType.ASSET))
        val tChecking       = accountRepo.save(Account(user = jcapellanTest, code = "1030", name = "Cuenta Corriente BHD", type = AccountType.ASSET))
        val tCreditCard     = accountRepo.save(Account(user = jcapellanTest, code = "2010", name = "Tarjeta de Crédito BHD", type = AccountType.LIABILITY))
        val tLoanGivenAcc   = accountRepo.save(Account(user = jcapellanTest, code = "3010", name = "Préstamo Dado – Juan Pérez", type = AccountType.ASSET))
        val tLoanRecvAcc    = accountRepo.save(Account(user = jcapellanTest, code = "3020", name = "Préstamo Recibido – BHD", type = AccountType.LIABILITY))
        val tEquity         = accountRepo.save(Account(user = jcapellanTest, code = "3000", name = "Capital Inicial", type = AccountType.EQUITY))
        val tSalary         = accountRepo.save(Account(user = jcapellanTest, code = "4010", name = "Salario", type = AccountType.INCOME))
        val tSuper          = accountRepo.save(Account(user = jcapellanTest, code = "5010", name = "Supermercado", type = AccountType.EXPENSE, thresholdPct = bd("20.00"), showInAlerts = true))
        val tGas            = accountRepo.save(Account(user = jcapellanTest, code = "5020", name = "Gasolina", type = AccountType.EXPENSE, thresholdPct = bd("10.00"), showInAlerts = true))
        val tRestaurant     = accountRepo.save(Account(user = jcapellanTest, code = "5030", name = "Restaurantes", type = AccountType.EXPENSE, thresholdPct = bd("15.00"), showInAlerts = true))
        val tServices       = accountRepo.save(Account(user = jcapellanTest, code = "5040", name = "Servicios", type = AccountType.EXPENSE, showInAlerts = false))
        val tFinancialExp   = accountRepo.save(Account(user = jcapellanTest, code = "5050", name = "Gastos Financieros", type = AccountType.EXPENSE))

        // ── Opening balance ────────────────────────────────────────────
        val tOpenEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 1, 1), description = "Saldos iniciales",
            source = JournalSource.OPENING_BALANCE, user = jcapellanTest,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tOpenEntry, account = tSavings,  side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("50000"), amountRd = bd("50000")),
            JournalLine(journalEntry = tOpenEntry, account = tChecking, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("10000"), amountRd = bd("10000")),
            JournalLine(journalEntry = tOpenEntry, account = tEquity,   side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = bd("60000"), amountRd = bd("60000")),
        ))

        // ── Payroll (Sep 2026) — US$500 @ 60.50 = RD$30,250 ──────────
        val tPayrollEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 9, 15), description = "Nómina septiembre 2026",
            source = JournalSource.INCOME, user = jcapellanTest,
        ))
        val tPayrollAmt = bd("30250")
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tPayrollEntry, account = tSavings, side = EntrySide.DEBIT,  currency = CurrencyType.USD, originalAmount = bd("500"), exchangeRate = payrollRate, amountRd = tPayrollAmt),
            JournalLine(journalEntry = tPayrollEntry, account = tSalary,  side = EntrySide.CREDIT, currency = CurrencyType.USD, originalAmount = bd("500"), exchangeRate = payrollRate, amountRd = tPayrollAmt),
        ))
        incomeEntryRepo.save(IncomeEntry(
            destinationAccount = tSavings, source = "payroll", currency = CurrencyType.USD,
            originalAmount = bd("500"), exchangeRate = payrollRate, bankFee = bd("0"),
            entryDate = LocalDate.of(2026, 9, 15), journalEntry = tPayrollEntry,
        ))

        // ── Expenses (Sep 2026) ────────────────────────────────────────
        val tSuperEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 9, 5), description = "SM Nacional",
            source = JournalSource.CARD_STATEMENT, user = jcapellanTest,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tSuperEntry, account = tSuper,      side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("3500"), amountRd = bd("3500")),
            JournalLine(journalEntry = tSuperEntry, account = tCreditCard, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = bd("3500"), amountRd = bd("3500")),
        ))

        val tGasEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 9, 8), description = "Shell",
            source = JournalSource.CARD_STATEMENT, user = jcapellanTest,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tGasEntry, account = tGas,        side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("2000"), amountRd = bd("2000")),
            JournalLine(journalEntry = tGasEntry, account = tCreditCard, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = bd("2000"), amountRd = bd("2000")),
        ))

        val tRestEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 9, 12), description = "Restaurante El Mesón",
            source = JournalSource.CARD_STATEMENT, user = jcapellanTest,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tRestEntry, account = tRestaurant, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("1800"), amountRd = bd("1800")),
            JournalLine(journalEntry = tRestEntry, account = tCreditCard, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = bd("1800"), amountRd = bd("1800")),
        ))

        val tServEntry = journalEntryRepo.save(JournalEntry(
            entryDate = LocalDate.of(2026, 9, 1), description = "Claro",
            source = JournalSource.CARD_STATEMENT, user = jcapellanTest,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tServEntry, account = tServices,   side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = bd("1500"), amountRd = bd("1500")),
            JournalLine(journalEntry = tServEntry, account = tCreditCard, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = bd("1500"), amountRd = bd("1500")),
        ))

        // ── Loan given: Juan Pérez — 20,000 RD$, 15% add-on, 5 weekly ─
        val tGivenPrincipal    = bd("20000")
        val tGivenTotal        = bd("23000")
        val tGivenInstallment  = bd("4600")
        val tGivenStartDate    = LocalDate.of(2026, 8, 1)

        val tLoanGivenDisb = journalEntryRepo.save(JournalEntry(
            entryDate = tGivenStartDate, description = "Préstamo otorgado – Juan Pérez",
            source = JournalSource.LOAN, user = jcapellanTest,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tLoanGivenDisb, account = tLoanGivenAcc, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = tGivenPrincipal, amountRd = tGivenPrincipal),
            JournalLine(journalEntry = tLoanGivenDisb, account = tSavings,      side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = tGivenPrincipal, amountRd = tGivenPrincipal),
        ))

        val tLoanGiven = loanRepo.save(Loan(
            account = tLoanGivenAcc, type = LoanType.GIVEN, counterpartyName = "Juan Pérez",
            principal = tGivenPrincipal, rate = bd("15.000"), frequency = LoanFrequency.WEEKLY,
            numInstallments = 5, installmentAmount = tGivenInstallment,
            startDate = tGivenStartDate, user = jcapellanTest,
        ))

        repeat(5) { i ->
            val num = i + 1
            val date = tGivenStartDate.plusWeeks(num.toLong())
            val amount = if (num == 5) tGivenTotal - tGivenInstallment * bd("4") else tGivenInstallment
            val paid = num <= 2
            val entry = if (paid) journalEntryRepo.save(JournalEntry(
                entryDate = date, description = "Cuota #$num – Juan Pérez",
                source = JournalSource.LOAN, referenceId = tLoanGiven.id, user = jcapellanTest,
            )) else null
            if (entry != null) journalLineRepo.saveAll(listOf(
                JournalLine(journalEntry = entry, account = tSavings,      side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = amount, amountRd = amount),
                JournalLine(journalEntry = entry, account = tLoanGivenAcc, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = amount, amountRd = amount),
            ))
            loanInstallmentRepo.save(LoanInstallment(
                loan = tLoanGiven, number = num, scheduledDate = date, scheduledAmount = amount,
                status = if (paid) InstallmentStatus.PAID else InstallmentStatus.PENDING,
                actualPaymentDate = if (paid) date else null, journalEntry = entry,
            ))
        }

        // ── Loan received: BHD — 150,000 RD$, 12% annual, 12 monthly ─
        val tRecvPrincipal  = bd("150000")
        val tMonthlyRate    = bd("0.12").divide(bd("12"), 10, RoundingMode.HALF_UP)
        val tPmt            = calculatePmt(tRecvPrincipal, tMonthlyRate, 12)
        val tRecvStartDate  = LocalDate.of(2026, 3, 1)

        val tLoanRecvDisb = journalEntryRepo.save(JournalEntry(
            entryDate = tRecvStartDate, description = "Préstamo recibido – BHD",
            source = JournalSource.LOAN, user = jcapellanTest,
        ))
        journalLineRepo.saveAll(listOf(
            JournalLine(journalEntry = tLoanRecvDisb, account = tSavings,     side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = tRecvPrincipal, amountRd = tRecvPrincipal),
            JournalLine(journalEntry = tLoanRecvDisb, account = tLoanRecvAcc, side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = tRecvPrincipal, amountRd = tRecvPrincipal),
        ))

        val tLoanRecv = loanRepo.save(Loan(
            account = tLoanRecvAcc, type = LoanType.RECEIVED, counterpartyName = "BHD",
            principal = tRecvPrincipal, rate = bd("12.000"), frequency = LoanFrequency.MONTHLY,
            numInstallments = 12, installmentAmount = tPmt.setScale(2, RoundingMode.HALF_UP),
            startDate = tRecvStartDate, user = jcapellanTest,
        ))

        var tBalance = tRecvPrincipal
        repeat(12) { i ->
            val num = i + 1
            val date = tRecvStartDate.plusMonths(num.toLong())
            val interest  = tBalance.multiply(tMonthlyRate).setScale(2, RoundingMode.HALF_UP)
            val principal = tPmt.subtract(interest).setScale(2, RoundingMode.HALF_UP)
            val amount    = if (num == 12) tBalance.add(interest) else tPmt.setScale(2, RoundingMode.HALF_UP)
            val paid      = date.isBefore(LocalDate.of(2026, 9, 1))
            val entry = if (paid) journalEntryRepo.save(JournalEntry(
                entryDate = date, description = "Cuota #$num – BHD",
                source = JournalSource.LOAN, referenceId = tLoanRecv.id, user = jcapellanTest,
            )) else null
            if (entry != null) journalLineRepo.saveAll(listOf(
                JournalLine(journalEntry = entry, account = tLoanRecvAcc,  side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = principal, amountRd = principal),
                JournalLine(journalEntry = entry, account = tFinancialExp, side = EntrySide.DEBIT,  currency = CurrencyType.RD, originalAmount = interest,  amountRd = interest),
                JournalLine(journalEntry = entry, account = tSavings,      side = EntrySide.CREDIT, currency = CurrencyType.RD, originalAmount = amount,    amountRd = amount),
            ))
            loanInstallmentRepo.save(LoanInstallment(
                loan = tLoanRecv, number = num, scheduledDate = date,
                scheduledAmount = amount, scheduledInterest = interest, scheduledPrincipal = principal,
                status = if (paid) InstallmentStatus.PAID else InstallmentStatus.PENDING,
                actualPaymentDate = if (paid) date else null, journalEntry = entry,
            ))
            tBalance = tBalance.subtract(principal)
        }

        // ── Budgets (September 2026) ───────────────────────────────────
        listOf(
            tSuper      to bd("15000"),
            tGas        to bd("5000"),
            tRestaurant to bd("8000"),
            tServices   to bd("7000"),
        ).forEach { (account, amount) ->
            budgetRepo.save(Budget(account = account, period = sep, amount = amount, origin = BudgetOrigin.MANUAL))
        }

        // ── Merchant dictionary ────────────────────────────────────────
        listOf(
            "SM Nacional" to tSuper,
            "La Sirena"   to tSuper,
            "Shell"       to tGas,
            "Esso"        to tGas,
            "Claro"       to tServices,
            "Altice"      to tServices,
        ).forEach { (pattern, account) ->
            merchantDictionaryRepo.save(MerchantDictionary(textPattern = pattern, account = account, user = jcapellanTest))
        }
    }

    private fun bd(value: String) = BigDecimal(value)

    private fun calculatePmt(pv: BigDecimal, monthlyRate: BigDecimal, n: Int): BigDecimal {
        val onePlusR = BigDecimal.ONE.add(monthlyRate)
        val factor = onePlusR.pow(n, MathContext.DECIMAL64)
        return pv.multiply(monthlyRate).multiply(factor)
            .divide(factor.subtract(BigDecimal.ONE), 2, RoundingMode.HALF_UP)
    }
}
