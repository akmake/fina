package com.fina.android.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable data class LoginRequest(val email: String, val password: String)
@Serializable data class RegisterRequest(val name: String, val email: String, val password: String)
@Serializable data class ProfileRequest(val name: String)
@Serializable data class PasswordRequest(val currentPassword: String, val newPassword: String)
@Serializable data class User(@SerialName("_id") val id: String = "", val name: String = "", val email: String = "", val role: String = "user", val createdAt: String? = null)
@Serializable data class AuthResponse(val message: String = "", val user: User)
@Serializable data class Account(@SerialName("_id") val id: String = "", val name: String = "", val balance: Double = 0.0)
@Serializable data class MonthTotals(val income: Double = 0.0, val expense: Double = 0.0)
@Serializable data class MonthlySummary(val thisMonth: MonthTotals = MonthTotals(), val prevMonth: MonthTotals = MonthTotals(), val effectiveMonth: String = "")
@Serializable data class Transaction(
    @SerialName("_id") val id: String = "",
    val description: String = "",
    val merchant: String = "",
    val category: String = "",
    val type: String = "",
    val amount: Double = 0.0,
    val date: String = "",
    val account: String = "checking"
)
@Serializable data class TransactionInput(val date: String, val description: String, val amount: Double, val type: String, val category: String, val account: String = "checking")
@Serializable data class Category(@SerialName("_id") val id: String = "", val name: String, val type: String = "", val color: String = "#64748b")
@Serializable data class BudgetItem(@SerialName("_id") val id: String = "", val category: String, val limit: Double, val spent: Double = 0.0, val color: String = "#3b82f6")
@Serializable data class Budget(@SerialName("_id") val id: String = "", val month: Int, val year: Int, val totalLimit: Double, val totalSpent: Double = 0.0, val items: List<BudgetItem> = emptyList(), val alertThreshold: Int = 80, val notes: String = "")
@Serializable data class BudgetResponse(val budget: Budget? = null, val spending: Map<String, Double> = emptyMap(), val uncategorizedSpending: Map<String, Double> = emptyMap(), val exists: Boolean = false)
@Serializable data class BudgetInput(val month: Int, val year: Int, val totalLimit: Double, val items: List<BudgetItem>, val alertThreshold: Int = 80, val notes: String = "")
@Serializable data class CategoryInput(val name: String, val type: String = "expense", val color: String = "#64748b")
@Serializable data class RecurringItem(@SerialName("_id") val id: String = "", val description: String, val amount: Double, val type: String, val category: String = "כללי", val account: String = "checking", val frequency: String = "monthly", val dayOfMonth: Int? = null, val startDate: String, val endDate: String? = null, val isActive: Boolean = true, val isPaused: Boolean = false, val subcategory: String = "other", val provider: String? = null, val notes: String? = null, val nextExecution: String? = null, val annualCost: Double = 0.0, val monthlyCost: Double = 0.0)
@Serializable data class RecurringSummary(val totalMonthlyExpenses: Double = 0.0, val totalMonthlyIncome: Double = 0.0, val totalAnnualExpenses: Double = 0.0, val totalAnnualIncome: Double = 0.0, val activeCount: Int = 0, val pausedCount: Int = 0, val subscriptionCount: Int = 0)
@Serializable data class RecurringResponse(val transactions: List<RecurringItem> = emptyList(), val summary: RecurringSummary = RecurringSummary())
@Serializable data class RecurringInput(val description: String, val amount: Double, val type: String, val category: String = "כללי", val account: String = "checking", val frequency: String = "monthly", val dayOfMonth: Int? = null, val startDate: String, val endDate: String? = null, val subcategory: String = "other", val provider: String? = null, val notes: String? = null, val remindDaysBefore: Int = 0)
@Serializable data class ToggleRecurringResponse(val transaction: RecurringItem)
@Serializable data class Stock(@SerialName("_id") val id: String = "", val ticker: String, val purchasePrice: Double, val investedAmount: Double, val currentPrice: Double = 0.0, val shares: Double = 0.0, val currentValueILS: Double = 0.0, val profitUSD: Double = 0.0, val lastUpdated: String? = null)
@Serializable data class StockInput(val ticker: String, val purchasePrice: Double, val investedAmount: Double, val sourceAccountName: String? = null)
@Serializable data class Deposit(@SerialName("_id") val id: String = "", val name: String, val principal: Double, val annualInterestRate: Double, val startDate: String, val endDate: String, val status: String = "active", val sourceAccount: String? = null, val exitPoints: List<String> = emptyList(), val futureValue: Double = 0.0)
@Serializable data class DepositInput(val name: String, val principal: Double, val annualInterestRate: Double, val startDate: String, val durationValue: Int, val durationUnit: String = "חודשים", val sourceAccount: String? = null, val exitPoints: List<String> = emptyList())
@Serializable data class ImportField(val name: String, val label: String, val type: String = "text", val inputMode: String? = null)
@Serializable data class ImportCompany(val value: String, val label: String, val group: String, val otpFlow: Boolean = false, val fields: List<ImportField> = emptyList())
@Serializable data class ImportPreview(val transactions: List<JsonObject> = emptyList(), val unseenMerchants: List<String> = emptyList(), val balances: List<JsonObject> = emptyList(), val futureDebits: List<JsonObject> = emptyList(), val rawAccounts: List<JsonObject>? = null, val otpLongTermToken: String? = null)
@Serializable data class OtpStartResponse(val otpContext: String? = null, val maskedPhone: String = "")
@Serializable data class ImportMapping(val originalName: String, val newName: String, val category: String? = null)
@Serializable data class ProcessImportRequest(val transactions: List<JsonObject>, val newMappings: List<ImportMapping>)
@Serializable data class MessageResponse(val message: String = "")
@Serializable data class DashboardResponse(
    val accounts: List<Account> = emptyList(),
    val monthlySummary: MonthlySummary = MonthlySummary(),
    val recentTransactions: List<Transaction> = emptyList()
)

// ─── Net worth (GET /net-worth) ─────────────────────────────────────────────
@Serializable data class NetWorthAssets(
    val checking: Double = 0.0, val cash: Double = 0.0,
    val deposits: Double = 0.0, val depositsCount: Int = 0,
    val stocks: Double = 0.0, val stocksCount: Int = 0,
    val funds: Double = 0.0, val fundsCount: Int = 0,
    val pension: Double = 0.0, val pensionCount: Int = 0,
    val realEstate: Double = 0.0, val realEstateCount: Int = 0,
    val foreignCurrency: Double = 0.0, val foreignCurrencyCount: Int = 0,
    val childSavings: Double = 0.0, val childSavingsCount: Int = 0,
    val totalLiquid: Double = 0.0, val totalInvestments: Double = 0.0,
    val totalSavings: Double = 0.0, val totalRealEstate: Double = 0.0,
    val total: Double = 0.0
)
@Serializable data class NetWorthLiabilities(
    val loans: Double = 0.0, val loansCount: Int = 0,
    val mortgages: Double = 0.0, val mortgagesCount: Int = 0,
    val overdraft: Double = 0.0, val total: Double = 0.0
)
@Serializable data class BreakdownSlice(val label: String = "", val value: Double = 0.0, val color: String = "#64748b")
@Serializable data class NetWorthResponse(
    val netWorth: Double = 0.0,
    val assets: NetWorthAssets = NetWorthAssets(),
    val liabilities: NetWorthLiabilities = NetWorthLiabilities(),
    val assetBreakdown: List<BreakdownSlice> = emptyList(),
    val liabilityBreakdown: List<BreakdownSlice> = emptyList()
)

// ─── Financial health score (GET /net-worth/health-score) ───────────────────
@Serializable data class HealthScoreItem(val category: String = "", val score: Int = 0, val maxScore: Int = 0, val detail: String = "")
@Serializable data class HealthTip(val priority: String = "low", val tip: String = "", val icon: String = "")
@Serializable data class HealthScoreResponse(
    val totalScore: Int = 0, val normalizedScore: Int = 0, val maxPossible: Int = 0,
    val grade: String = "", val gradeLabel: String = "", val gradeColor: String = "#64748b",
    val scores: List<HealthScoreItem> = emptyList(), val tips: List<HealthTip> = emptyList()
)

// ─── Net worth history (GET /net-worth/history) ─────────────────────────────
@Serializable data class NetWorthHistoryPoint(val label: String = "", val netWorth: Double = 0.0, val assets: Double = 0.0, val liabilities: Double = 0.0)
@Serializable data class NetWorthHistoryResponse(val history: List<NetWorthHistoryPoint> = emptyList())

// ─── Smart analytics (GET /analytics/smart-analytics) ───────────────────────
@Serializable data class TopCategory(val category: String = "", val total: Double = 0.0, val count: Int = 0, val percentage: Double = 0.0)
@Serializable data class AnalyticsData(val topCategories: List<TopCategory> = emptyList())
@Serializable data class SmartAnalyticsResponse(val status: String = "", val data: AnalyticsData = AnalyticsData())

// ─── Recommendations (GET /analytics/recommendations) ───────────────────────
@Serializable data class Recommendation(
    val priority: String = "low", val type: String = "",
    val suggestion: String? = null, val text: String? = null, val title: String? = null, val message: String? = null,
    val potentialSavings: Double? = null, val savings: Double? = null,
    val actionLabel: String? = null
) { val body: String get() = suggestion ?: text ?: title ?: message ?: "" }
@Serializable data class RecommendationsData(val recommendations: List<Recommendation> = emptyList())
@Serializable data class RecommendationsResponse(val status: String = "", val data: RecommendationsData = RecommendationsData())

// ─── Yearly comparison (GET /reports/yearly-comparison) ─────────────────────
@Serializable data class YearMonthTotals(val income: Double = 0.0, val expense: Double = 0.0, val net: Double = 0.0)
@Serializable data class YearData(
    val totalIncome: Double = 0.0, val totalExpense: Double = 0.0, val totalNet: Double = 0.0,
    val savingsRate: Double = 0.0, val monthly: Map<String, YearMonthTotals> = emptyMap()
)
@Serializable data class YearlyComparison(val incomeChange: Double = 0.0, val expenseChange: Double = 0.0, val savingsRateChange: Double = 0.0)
@Serializable data class YearlyComparisonResponse(val years: Map<String, YearData> = emptyMap(), val comparison: YearlyComparison = YearlyComparison())

// ─── Alerts (GET /alerts) ───────────────────────────────────────────────────
@Serializable data class Alert(
    @SerialName("_id") val id: String = "", val message: String? = null, val title: String? = null,
    val type: String = "", val severity: String = "", val read: Boolean = false, val createdAt: String? = null
) { val body: String get() = message ?: title ?: "" }
@Serializable data class AlertsResponse(val alerts: List<Alert> = emptyList(), val unreadCount: Int = 0)
