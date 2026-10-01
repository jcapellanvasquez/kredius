package com.kredius.be.config

import com.kredius.be.entity.*
import com.kredius.be.repository.*
import org.springframework.boot.CommandLineRunner
import org.springframework.stereotype.Component
import java.math.BigDecimal

@Component
class DataInitializer(
    private val userRepo: UserRepository,
    private val accountRepo: AccountRepository,
    private val merchantRepo: MerchantDictionaryRepository,
) : CommandLineRunner {

    override fun run(vararg args: String) {
        val jcapellan = userRepo.save(User(name = "jcapellan", email = "jcapellan@kredius.local"))

        // Assets
        accountRepo.save(Account(user = jcapellan, code = 1001, name = "Cuenta Ahorros BHD",    type = AccountType.ASSET, icon = "building-bank", statementType = StatementType.SAVINGS))

        // Liabilities
        val card = accountRepo.save(Account(user = jcapellan, code = 2001, name = "Tarjeta de Crédito BHD", type = AccountType.LIABILITY, icon = "credit-card", statementType = StatementType.CREDIT_CARD))

        // Equity
        accountRepo.save(Account(user = jcapellan, code = 3001, name = "Capital Inicial",        type = AccountType.EQUITY, icon = "coins"))

        // Income
        accountRepo.save(Account(user = jcapellan, code = 4001, name = "Salario",                type = AccountType.INCOME, icon = "briefcase"))
        accountRepo.save(Account(user = jcapellan, code = 4002, name = "Intereses Ganados",      type = AccountType.INCOME, icon = "coins"))
        val cashback = accountRepo.save(Account(user = jcapellan, code = 4003, name = "Cashback y reembolsos", type = AccountType.INCOME, icon = "gift"))

        // Expenses
        accountRepo.save(Account(user = jcapellan, code = 5001, name = "Supermercado",    type = AccountType.EXPENSE, icon = "shopping-cart", thresholdPct = BigDecimal("20.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5002, name = "Gasolina",        type = AccountType.EXPENSE, icon = "gas-station", thresholdPct = BigDecimal("10.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5003, name = "Restaurantes",    type = AccountType.EXPENSE, icon = "tools-kitchen-2", thresholdPct = BigDecimal("15.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5004, name = "Servicios",       type = AccountType.EXPENSE, icon = "bolt", showInAlerts = false))
        val financialExpenses = accountRepo.save(Account(user = jcapellan, code = 5005, name = "Gastos Financieros", type = AccountType.EXPENSE, icon = "receipt"))
        accountRepo.save(Account(user = jcapellan, code = 5006, name = "Retiros en efectivo",   type = AccountType.EXPENSE, icon = "receipt"))
        accountRepo.save(Account(user = jcapellan, code = 5007, name = "Recargas",              type = AccountType.EXPENSE, icon = "cash"))
        accountRepo.save(Account(user = jcapellan, code = 5008, name = "Servicios del hogar",   type = AccountType.EXPENSE, icon = "briefcase"))
        accountRepo.save(Account(user = jcapellan, code = 5009, name = "Comisiones banco",      type = AccountType.EXPENSE, icon = "coins"))
        accountRepo.save(Account(user = jcapellan, code = 5010, name = "Subscripciones online", type = AccountType.EXPENSE, icon = "refresh"))
        accountRepo.save(Account(user = jcapellan, code = 5011, name = "Compras online",        type = AccountType.EXPENSE, icon = "bolt"))
        accountRepo.save(Account(user = jcapellan, code = 5012, name = "Diversion",             type = AccountType.EXPENSE, icon = "confetti"))
        accountRepo.save(Account(user = jcapellan, code = 5013, name = "Mantenimiento carro",   type = AccountType.EXPENSE, icon = "car"))
        accountRepo.save(Account(user = jcapellan, code = 5014, name = "Personales",            type = AccountType.EXPENSE, icon = "user"))
        accountRepo.save(Account(user = jcapellan, code = 5015, name = "Hogar",                 type = AccountType.EXPENSE, icon = "home"))

        // Card payments are posted from the savings statement ("PAGO DE TC …"); the card's own payment row is excluded.
        merchantRepo.save(MerchantDictionary(user = jcapellan, textPattern = "PAGO DE TC", account = card))
        // The card's cashback program credit.
        merchantRepo.save(MerchantDictionary(user = jcapellan, textPattern = "AHORRO MI PAIS", account = cashback))
        // The transfer tax charged next to every card and loan payment on the savings statement.
        merchantRepo.save(MerchantDictionary(user = jcapellan, textPattern = "Imp. transferencia", account = financialExpenses))
    }
}
