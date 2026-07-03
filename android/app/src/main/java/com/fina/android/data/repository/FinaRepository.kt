package com.fina.android.data.repository

import android.content.Context
import com.fina.android.BuildConfig
import com.fina.android.data.api.FinaApi
import com.fina.android.data.api.PersistentCookieJar
import com.fina.android.data.model.*
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.MediaType.Companion.toMediaType
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.*

class FinaRepository private constructor(private val api: FinaApi, private val cookieJar: PersistentCookieJar) {
    private val refreshMutex = Mutex()

    suspend fun login(email: String, password: String) = api.login(LoginRequest(email.trim(), password))
    suspend fun register(name: String, email: String, password: String) = api.register(RegisterRequest(name.trim(), email.trim(), password))
    suspend fun restoreSession(): AuthResponse? = refreshMutex.withLock { api.refresh().body() }
    suspend fun dashboard(): DashboardResponse = withRefresh { api.dashboard() }

    // Full dashboard bundle — every panel fetched in parallel, resiliently (one failure
    // does not blank the whole screen), mirroring the web dashboard's Promise.allSettled.
    suspend fun dashboardBundle(): DashboardBundle = coroutineScope {
        val now = LocalDate.now()
        fun iso(d: LocalDate) = d.atStartOfDay(ZoneOffset.UTC).toInstant().toString()
        val curStart = now.withDayOfMonth(1)
        val prev = now.minusMonths(1)
        val prevStart = prev.withDayOfMonth(1)
        val prevEnd = prev.withDayOfMonth(prev.lengthOfMonth())

        val summary = async { optional { api.dashboard() } }
        val netWorth = async { optional { api.netWorth() } }
        val health = async { optional { api.healthScore() } }
        val history = async { optional { api.netWorthHistory() } }
        val budget = async { optional { api.budget(now.monthValue, now.year) } }
        val cur = async { optional { api.smartAnalytics(iso(curStart), iso(now)) } }
        val prv = async { optional { api.smartAnalytics(iso(prevStart), iso(prevEnd)) } }
        val recs = async { optional { api.recommendations() } }
        val alerts = async { optional { api.alerts() } }
        val yearly = async { optional { api.yearlyComparison() } }

        DashboardBundle(
            summary = summary.await(),
            netWorth = netWorth.await(),
            health = health.await(),
            history = history.await(),
            budget = budget.await(),
            topCategories = cur.await()?.data?.topCategories.orEmpty(),
            prevCategories = prv.await()?.data?.topCategories.orEmpty(),
            recommendations = recs.await()?.data?.recommendations.orEmpty(),
            alerts = alerts.await(),
            yearly = yearly.await()
        )
    }
    suspend fun transactions() = withRefresh { api.transactions(limit = 500) }
    suspend fun searchTransactions(query: String, type: String?) = withRefresh { api.searchTransactions(query, type) }
    suspend fun categories() = withRefresh { api.categories() }
    suspend fun addTransaction(input: TransactionInput) = withRefresh { api.addTransaction(input) }
    suspend fun updateTransaction(id: String, input: TransactionInput) = withRefresh { api.updateTransaction(id, input) }
    suspend fun deleteTransaction(id: String) = withRefresh { api.deleteTransaction(id) }
    suspend fun addCategory(input: CategoryInput) = withRefresh { api.addCategory(input) }
    suspend fun deleteCategory(id: String) = withRefresh { api.deleteCategory(id) }
    suspend fun syncCategories() = withRefresh { api.syncCategories() }
    suspend fun budget(month: Int, year: Int) = withRefresh { api.budget(month, year) }
    suspend fun saveBudget(input: BudgetInput) = withRefresh { api.saveBudget(input) }
    suspend fun deleteBudget(id: String) = withRefresh { api.deleteBudget(id) }
    suspend fun recurring() = withRefresh { api.recurring() }
    suspend fun addRecurring(input: RecurringInput) = withRefresh { api.addRecurring(input) }
    suspend fun updateRecurring(id: String, input: RecurringInput) = withRefresh { api.updateRecurring(id, input) }
    suspend fun deleteRecurring(id: String) = withRefresh { api.deleteRecurring(id) }
    suspend fun toggleRecurring(id: String) = withRefresh { api.toggleRecurring(id) }
    suspend fun stocks() = withRefresh { api.stocks() }
    suspend fun addStock(input: StockInput) = withRefresh { api.addStock(input) }
    suspend fun deleteStock(id: String) = withRefresh { api.deleteStock(id) }
    suspend fun sellStock(id: String) = withRefresh { api.sellStock(id) }
    suspend fun refreshStocks() = withRefresh { api.refreshStocks() }
    suspend fun deposits() = withRefresh { api.deposits() }
    suspend fun addDeposit(input: DepositInput) = withRefresh { api.addDeposit(input) }
    suspend fun breakDeposit(id: String) = withRefresh { api.breakDeposit(id) }
    suspend fun withdrawDeposit(id: String) = withRefresh { api.withdrawDeposit(id) }
    suspend fun importCompanies() = withRefresh { api.importCompanies() }
    suspend fun scrape(company: String, startDate: String, incomesOnly: Boolean, fields: Map<String, String>) = withRefresh {
        api.scrape(buildJsonObject { put("company", company); put("startDate", startDate); put("incomesOnly", incomesOnly); fields.forEach { (key, value) -> put(key, value) } })
    }
    suspend fun oneZeroStart(phone: String) = withRefresh { api.oneZeroOtpStart(buildJsonObject { put("phoneNumber", phone) }) }
    suspend fun oneZeroVerify(context: String, code: String, email: String, password: String, startDate: String, incomesOnly: Boolean) = withRefresh { api.oneZeroOtpVerify(buildJsonObject { put("otpContext", context); put("otpCode", code); put("email", email); put("password", password); put("startDate", startDate); put("incomesOnly", incomesOnly) }) }
    suspend fun calStart(id: String, last4: String) = withRefresh { api.calOtpStart(buildJsonObject { put("id", id); put("last4", last4) }) }
    suspend fun calVerify(id: String, last4: String, code: String, startDate: String) = withRefresh { api.calOtpVerify(buildJsonObject { put("id", id); put("last4", last4); put("otp", code); put("startDate", startDate) }) }
    suspend fun processImport(transactions: List<JsonObject>, mappings: List<ImportMapping>) = withRefresh { api.processImport(ProcessImportRequest(transactions, mappings)) }
    suspend fun logout() { runCatching { api.logout() }; cookieJar.clear() }
    suspend fun updateProfile(name: String) = withRefresh { api.updateProfile(ProfileRequest(name)) }
    suspend fun changePassword(current: String, new: String) = withRefresh { api.changePassword(PasswordRequest(current, new)) }

    // Session-aware but failure-tolerant: refreshes on 401, but returns null for any
    // other error so a single dead endpoint can't blank an entire dashboard.
    private suspend fun <T> optional(block: suspend () -> T): T? = try {
        withRefresh(block)
    } catch (expired: SessionExpiredException) {
        throw expired
    } catch (error: Exception) {
        null
    }

    private suspend fun <T> withRefresh(block: suspend () -> T): T = try {
        block()
    } catch (error: HttpException) {
        if (error.code() != 401) throw error
        val refreshed = refreshMutex.withLock { api.refresh().isSuccessful }
        if (!refreshed) { cookieJar.clear(); throw SessionExpiredException() }
        block()
    }

    companion object {
        fun create(context: Context): FinaRepository {
            val jar = PersistentCookieJar(context)
            val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
            val client = OkHttpClient.Builder()
                .cookieJar(jar)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(3, TimeUnit.MINUTES)
                .writeTimeout(3, TimeUnit.MINUTES)
                .callTimeout(4, TimeUnit.MINUTES)
                .addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("X-Fina-Client", "web-app").build()) }
                .apply { if (BuildConfig.DEBUG) addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC)) }
                .build()
            val api = Retrofit.Builder().baseUrl(BuildConfig.API_BASE_URL).client(client)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType())).build().create(FinaApi::class.java)
            return FinaRepository(api, jar)
        }
    }
}

class SessionExpiredException : Exception("פג תוקף החיבור, יש להתחבר מחדש")

data class DashboardBundle(
    val summary: DashboardResponse? = null,
    val netWorth: NetWorthResponse? = null,
    val health: HealthScoreResponse? = null,
    val history: NetWorthHistoryResponse? = null,
    val budget: BudgetResponse? = null,
    val topCategories: List<TopCategory> = emptyList(),
    val prevCategories: List<TopCategory> = emptyList(),
    val recommendations: List<Recommendation> = emptyList(),
    val alerts: AlertsResponse? = null,
    val yearly: YearlyComparisonResponse? = null
)
