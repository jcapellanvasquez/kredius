package com.kredius.be.service

import com.kredius.be.entity.Account
import com.kredius.be.entity.AccountType
import com.kredius.be.entity.User
import com.kredius.be.exception.ApiException
import com.kredius.be.model.CreateAccountRequest
import com.kredius.be.repository.AccountRepository
import com.kredius.be.repository.JournalLineRepository
import com.kredius.be.repository.LoanRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.any
import org.mockito.Mockito.anyInt
import org.mockito.Mockito.eq
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import kotlin.test.assertEquals
import com.kredius.be.model.AccountType as ApiAccountType

class AccountServiceTest {

    private val userId = 1L
    private val accountRepo = mock(AccountRepository::class.java)
    private val currentUser = mock(CurrentUserService::class.java)
    private val service = AccountService(
        accountRepo, mock(LoanRepository::class.java), mock(JournalLineRepository::class.java), currentUser,
    )

    @BeforeEach
    fun setUp() {
        `when`(currentUser.id).thenReturn(userId)
        `when`(currentUser.user).thenReturn(User(id = userId))
        `when`(accountRepo.saveAndFlush(any(Account::class.java))).thenAnswer { it.arguments[0] }
    }

    private fun highestAssetCode(code: Int?, forUser: Long = userId) {
        `when`(accountRepo.findTopByUserIdAndCodeBetweenOrderByCodeDesc(forUser, 1001, 1999))
            .thenReturn(code?.let { Account(code = it, type = AccountType.ASSET) })
    }

    private fun createAsset() = service.create(CreateAccountRequest(name = "Nueva", type = ApiAccountType.ASSET))

    @Test
    fun `empty range starts at x001`() {
        assertEquals(1001, createAsset().code)
    }

    @Test
    fun `next code follows the highest`() {
        highestAssetCode(1003)
        assertEquals(1004, createAsset().code)
    }

    @Test
    fun `gaps are not filled`() {
        highestAssetCode(1005) // 1001 and 1005 exist; the query returns the highest
        assertEquals(1006, createAsset().code)
    }

    @Test
    fun `other users' codes are ignored`() {
        highestAssetCode(1500, forUser = 2L)
        assertEquals(1001, createAsset().code)
    }

    @Test
    fun `full range is rejected with 422`() {
        highestAssetCode(1999)
        val ex = assertThrows<ApiException> { createAsset() }
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, ex.httpStatus)
    }

    @Test
    fun `collision on insert retries once with a fresh read`() {
        `when`(accountRepo.findTopByUserIdAndCodeBetweenOrderByCodeDesc(eq(userId), anyInt(), anyInt()))
            .thenReturn(Account(code = 1003), Account(code = 1004))
        `when`(accountRepo.saveAndFlush(any(Account::class.java)))
            .thenThrow(DataIntegrityViolationException("duplicate code"))
            .thenAnswer { it.arguments[0] }

        assertEquals(1005, createAsset().code)
        verify(accountRepo, times(2)).saveAndFlush(any(Account::class.java))
    }

    @Test
    fun `a second collision is not retried`() {
        `when`(accountRepo.saveAndFlush(any(Account::class.java)))
            .thenThrow(DataIntegrityViolationException("duplicate code"))

        assertThrows<DataIntegrityViolationException> { createAsset() }
        verify(accountRepo, times(2)).saveAndFlush(any(Account::class.java))
    }
}
