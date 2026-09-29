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
        accountRepo.save(Account(user = jcapellan, code = 1001, name = "Cuenta Ahorros BHD",    type = AccountType.ASSET))

        // Liabilities
        val card = accountRepo.save(Account(user = jcapellan, code = 2001, name = "Tarjeta de Crédito BHD", type = AccountType.LIABILITY))

        // Equity
        accountRepo.save(Account(user = jcapellan, code = 3001, name = "Capital Inicial",        type = AccountType.EQUITY))

        // Income
        accountRepo.save(Account(user = jcapellan, code = 4001, name = "Salario",                type = AccountType.INCOME))
        accountRepo.save(Account(user = jcapellan, code = 4002, name = "Intereses Ganados",      type = AccountType.INCOME))

        // Expenses
        accountRepo.save(Account(user = jcapellan, code = 5001, name = "Supermercado",    type = AccountType.EXPENSE, thresholdPct = BigDecimal("20.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5002, name = "Gasolina",        type = AccountType.EXPENSE, thresholdPct = BigDecimal("10.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5003, name = "Restaurantes",    type = AccountType.EXPENSE, thresholdPct = BigDecimal("15.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5004, name = "Servicios",       type = AccountType.EXPENSE, showInAlerts = false))
        accountRepo.save(Account(user = jcapellan, code = 5005, name = "Gastos Financieros", type = AccountType.EXPENSE))

        // Card payments are posted from the savings statement ("PAGO DE TC …"); the card's own payment row is excluded.
        merchantRepo.save(MerchantDictionary(user = jcapellan, textPattern = "PAGO DE TC", account = card))
    }
}
