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
) : CommandLineRunner {

    override fun run(vararg args: String) {
        val jcapellan = userRepo.save(User(name = "jcapellan", email = "jcapellan@kredius.local"))

        // Assets
        accountRepo.save(Account(user = jcapellan, code = 1001, name = "Cuenta Ahorros BHD",    type = AccountType.ASSET))
        accountRepo.save(Account(user = jcapellan, code = 1002, name = "Cuenta Corriente BHD",  type = AccountType.ASSET))

        // Liabilities
        accountRepo.save(Account(user = jcapellan, code = 2010, name = "Tarjeta de Crédito BHD", type = AccountType.LIABILITY))

        // Equity
        accountRepo.save(Account(user = jcapellan, code = 3001, name = "Capital Inicial",        type = AccountType.EQUITY))

        // Income
        accountRepo.save(Account(user = jcapellan, code = 4001, name = "Salario",                type = AccountType.INCOME))
        accountRepo.save(Account(user = jcapellan, code = 4010, name = "Intereses Ganados",      type = AccountType.INCOME))

        // Expenses
        accountRepo.save(Account(user = jcapellan, code = 5010, name = "Supermercado",    type = AccountType.EXPENSE, thresholdPct = BigDecimal("20.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5020, name = "Gasolina",        type = AccountType.EXPENSE, thresholdPct = BigDecimal("10.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5030, name = "Restaurantes",    type = AccountType.EXPENSE, thresholdPct = BigDecimal("15.00"), showInAlerts = true))
        accountRepo.save(Account(user = jcapellan, code = 5040, name = "Servicios",       type = AccountType.EXPENSE, showInAlerts = false))
        accountRepo.save(Account(user = jcapellan, code = 5050, name = "Gastos Financieros", type = AccountType.EXPENSE))
    }
}
