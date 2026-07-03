package com.fina.android.data.api

import com.fina.android.data.model.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.DELETE
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query
import kotlinx.serialization.json.JsonObject
import retrofit2.http.POST

interface FinaApi {
    @POST("auth/login") suspend fun login(@Body body: LoginRequest): AuthResponse
    @POST("auth/register") suspend fun register(@Body body: RegisterRequest): AuthResponse
    @POST("auth/refresh") suspend fun refresh(): Response<AuthResponse>
    @POST("auth/logout") suspend fun logout(): Response<Unit>
    @PUT("auth/profile") suspend fun updateProfile(@Body body: ProfileRequest): AuthResponse
    @PUT("auth/change-password") suspend fun changePassword(@Body body: PasswordRequest): Response<Unit>
    @GET("dashboard/summary") suspend fun dashboard(): DashboardResponse
    @GET("net-worth") suspend fun netWorth(): NetWorthResponse
    @GET("net-worth/health-score") suspend fun healthScore(): HealthScoreResponse
    @GET("net-worth/history") suspend fun netWorthHistory(): NetWorthHistoryResponse
    @GET("analytics/smart-analytics") suspend fun smartAnalytics(@Query("startDate") startDate: String, @Query("endDate") endDate: String): SmartAnalyticsResponse
    @GET("analytics/recommendations") suspend fun recommendations(): RecommendationsResponse
    @GET("reports/yearly-comparison") suspend fun yearlyComparison(): YearlyComparisonResponse
    @GET("alerts") suspend fun alerts(): AlertsResponse
    @GET("transactions") suspend fun transactions(@Query("from") from: String? = null, @Query("to") to: String? = null, @Query("before") before: String? = null, @Query("limit") limit: Int? = null): List<Transaction>
    @GET("transactions/search") suspend fun searchTransactions(@Query("q") query: String, @Query("type") type: String? = null): List<Transaction>
    @POST("transactions") suspend fun addTransaction(@Body body: TransactionInput): Transaction
    @PUT("transactions/{id}") suspend fun updateTransaction(@Path("id") id: String, @Body body: TransactionInput): Transaction
    @DELETE("transactions/{id}") suspend fun deleteTransaction(@Path("id") id: String): Response<Unit>
    @GET("categories") suspend fun categories(): List<Category>
    @POST("categories") suspend fun addCategory(@Body body: CategoryInput): Category
    @DELETE("categories/{id}") suspend fun deleteCategory(@Path("id") id: String): Response<Unit>
    @POST("categories/sync") suspend fun syncCategories(): Response<Unit>
    @GET("budgets") suspend fun budget(@Query("month") month: Int, @Query("year") year: Int): BudgetResponse
    @POST("budgets") suspend fun saveBudget(@Body body: BudgetInput): Budget
    @DELETE("budgets/{id}") suspend fun deleteBudget(@Path("id") id: String): Response<Unit>
    @GET("recurring") suspend fun recurring(): RecurringResponse
    @POST("recurring") suspend fun addRecurring(@Body body: RecurringInput): RecurringItem
    @PUT("recurring/{id}") suspend fun updateRecurring(@Path("id") id: String, @Body body: RecurringInput): RecurringItem
    @DELETE("recurring/{id}") suspend fun deleteRecurring(@Path("id") id: String): Response<Unit>
    @POST("recurring/{id}/toggle") suspend fun toggleRecurring(@Path("id") id: String): ToggleRecurringResponse
    @GET("stocks") suspend fun stocks(): List<Stock>
    @POST("stocks") suspend fun addStock(@Body body: StockInput): Stock
    @DELETE("stocks/{id}") suspend fun deleteStock(@Path("id") id: String): Response<Unit>
    @POST("stocks/{id}/sell") suspend fun sellStock(@Path("id") id: String): Response<Unit>
    @POST("stocks/refresh-prices") suspend fun refreshStocks(): Response<Unit>
    @GET("deposits") suspend fun deposits(): List<Deposit>
    @POST("deposits") suspend fun addDeposit(@Body body: DepositInput): Deposit
    @POST("deposits/{id}/break") suspend fun breakDeposit(@Path("id") id: String): Response<Unit>
    @POST("deposits/{id}/withdraw") suspend fun withdrawDeposit(@Path("id") id: String): Response<Unit>
    @GET("scrape/companies") suspend fun importCompanies(): List<ImportCompany>
    @POST("scrape") suspend fun scrape(@Body body: JsonObject): ImportPreview
    @POST("scrape/onezero/otp/start") suspend fun oneZeroOtpStart(@Body body: JsonObject): OtpStartResponse
    @POST("scrape/onezero/otp/verify") suspend fun oneZeroOtpVerify(@Body body: JsonObject): ImportPreview
    @POST("cal/request-otp") suspend fun calOtpStart(@Body body: JsonObject): OtpStartResponse
    @POST("cal/verify-otp-import") suspend fun calOtpVerify(@Body body: JsonObject): ImportPreview
    @POST("import/process-transactions") suspend fun processImport(@Body body: ProcessImportRequest): MessageResponse
}
