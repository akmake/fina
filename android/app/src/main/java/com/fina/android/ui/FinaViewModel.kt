package com.fina.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fina.android.data.repository.DashboardBundle
import com.fina.android.data.model.User
import com.fina.android.data.model.Transaction
import com.fina.android.data.model.TransactionInput
import com.fina.android.data.model.Category
import com.fina.android.data.model.BudgetResponse
import com.fina.android.data.model.BudgetInput
import com.fina.android.data.model.CategoryInput
import com.fina.android.data.model.RecurringResponse
import com.fina.android.data.model.RecurringInput
import com.fina.android.data.model.Stock
import com.fina.android.data.model.StockInput
import com.fina.android.data.model.Deposit
import com.fina.android.data.model.DepositInput
import com.fina.android.data.model.ImportCompany
import com.fina.android.data.model.ImportPreview
import com.fina.android.data.model.ImportMapping
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.serialization.json.*
import com.fina.android.data.repository.FinaRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class FinaState(
    val checkingSession: Boolean = true,
    val loading: Boolean = false,
    val user: User? = null,
    val dashboard: DashboardBundle? = null,
    val transactions: List<Transaction> = emptyList(),
    val categories: List<Category> = emptyList(),
    val transactionType: String? = null,
    val transactionQuery: String = "",
    val transactionsLoaded: Boolean = false,
    val budget: BudgetResponse? = null,
    val recurring: RecurringResponse? = null,
    val stocks: List<Stock> = emptyList(),
    val deposits: List<Deposit> = emptyList(),
    val importCompanies: List<ImportCompany> = emptyList(),
    val importPreview: ImportPreview? = null,
    val importStage: String = "credentials",
    val importMessage: String? = null,
    val otpContext: String? = null,
    val error: String? = null
)

class FinaViewModel(private val repository: FinaRepository) : ViewModel() {
    private val _state = MutableStateFlow(FinaState())
    val state = _state.asStateFlow()
    private var searchJob: Job? = null

    init { restoreSession() }

    private fun restoreSession() = viewModelScope.launch {
        val auth = runCatching { repository.restoreSession() }.getOrNull()
        _state.value = _state.value.copy(checkingSession = false, user = auth?.user)
        if (auth != null) loadDashboard()
    }

    fun login(email: String, password: String) = viewModelScope.launch {
        if (email.isBlank() || password.isBlank()) {
            _state.value = _state.value.copy(error = "נא למלא אימייל וסיסמה"); return@launch
        }
        _state.value = _state.value.copy(loading = true, error = null)
        runCatching { repository.login(email, password) }
            .onSuccess { _state.value = _state.value.copy(loading = false, user = it.user); loadDashboard() }
            .onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) }
    }

    fun register(name: String, email: String, password: String, confirmation: String) = viewModelScope.launch {
        val validation = when { name.isBlank() || email.isBlank() -> "נא למלא שם ואימייל"; password.length < 8 -> "הסיסמה חייבת להכיל לפחות 8 תווים"; password != confirmation -> "הסיסמאות אינן תואמות"; else -> null }
        if (validation != null) { _state.value = _state.value.copy(error = validation); return@launch }
        _state.value = _state.value.copy(loading = true, error = null)
        runCatching { repository.register(name, email, password) }.onSuccess { _state.value = _state.value.copy(loading = false, user = it.user); loadDashboard() }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) }
    }

    fun updateProfile(name: String, done: () -> Unit) = viewModelScope.launch { _state.value = _state.value.copy(loading = true); runCatching { repository.updateProfile(name) }.onSuccess { _state.value = _state.value.copy(loading = false, user = it.user); done() }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }
    fun changePassword(current: String, new: String, confirmation: String, done: () -> Unit) = viewModelScope.launch { if (new.length < 8 || new != confirmation) { _state.value = _state.value.copy(error = if (new.length < 8) "הסיסמה חייבת להכיל לפחות 8 תווים" else "הסיסמאות אינן תואמות"); return@launch }; _state.value = _state.value.copy(loading = true); runCatching { repository.changePassword(current, new) }.onSuccess { _state.value = _state.value.copy(loading = false); done() }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }

    fun loadDashboard() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        runCatching { repository.dashboardBundle() }
            .onSuccess { _state.value = _state.value.copy(loading = false, dashboard = it) }
            .onFailure { error ->
                val expired = error is com.fina.android.data.repository.SessionExpiredException
                _state.value = _state.value.copy(loading = false, user = if (expired) null else _state.value.user, error = error.userMessage())
            }
    }

    fun logout() = viewModelScope.launch {
        repository.logout(); _state.value = FinaState(checkingSession = false)
    }

    fun loadTransactions() = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        runCatching { repository.transactions() to repository.categories() }
            .onSuccess { (items, categories) ->
                val filtered = when (_state.value.transactionType) {
                    "income" -> items.filter { it.type.contains("הכנס") }
                    "expense" -> items.filterNot { it.type.contains("הכנס") }
                    else -> items
                }
                _state.value = _state.value.copy(loading = false, transactions = filtered, categories = categories, transactionsLoaded = true)
            }
            .onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) }
    }

    fun filterTransactions(query: String = _state.value.transactionQuery, type: String? = _state.value.transactionType) {
        _state.value = _state.value.copy(transactionQuery = query, transactionType = type)
        searchJob?.cancel()
        if (query.isBlank()) { loadTransactions(); return }
        searchJob = viewModelScope.launch {
            delay(300); runCatching { repository.searchTransactions(query, type) }
                .onSuccess { _state.value = _state.value.copy(transactions = it, loading = false) }
                .onFailure { _state.value = _state.value.copy(error = it.userMessage(), loading = false) }
        }
    }

    fun saveTransaction(id: String?, input: TransactionInput, done: () -> Unit) = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        runCatching { if (id == null) repository.addTransaction(input) else repository.updateTransaction(id, input) }
            .onSuccess { loadTransactions(); loadDashboard(); done() }
            .onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) }
    }

    fun deleteTransaction(id: String) = viewModelScope.launch {
        runCatching { repository.deleteTransaction(id) }
            .onSuccess { _state.value = _state.value.copy(transactions = _state.value.transactions.filterNot { it.id == id }); loadDashboard() }
            .onFailure { _state.value = _state.value.copy(error = it.userMessage()) }
    }

    fun addCategory(name: String, type: String, done: () -> Unit = {}) = viewModelScope.launch {
        runCatching { repository.addCategory(CategoryInput(name, type)) }
            .onSuccess { _state.value = _state.value.copy(categories = (_state.value.categories + it).sortedBy { c -> c.name }); done() }
            .onFailure { _state.value = _state.value.copy(error = it.userMessage()) }
    }

    fun deleteCategory(id: String) = viewModelScope.launch {
        runCatching { repository.deleteCategory(id) }.onSuccess { _state.value = _state.value.copy(categories = _state.value.categories.filterNot { it.id == id }) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) }
    }

    fun syncCategories() = viewModelScope.launch { runCatching { repository.syncCategories(); repository.categories() }.onSuccess { _state.value = _state.value.copy(categories = it) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) } }

    fun loadBudget(month: Int, year: Int) = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true)
        runCatching { repository.budget(month, year) to repository.categories() }.onSuccess { _state.value = _state.value.copy(loading = false, budget = it.first, categories = it.second) }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) }
    }

    fun saveBudget(input: BudgetInput) = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true)
        runCatching { repository.saveBudget(input) }.onSuccess { loadBudget(input.month, input.year) }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) }
    }

    fun deleteBudget(id: String, month: Int, year: Int) = viewModelScope.launch { runCatching { repository.deleteBudget(id) }.onSuccess { loadBudget(month, year) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) } }

    fun loadRecurring() = viewModelScope.launch { _state.value = _state.value.copy(loading = true); runCatching { repository.recurring() }.onSuccess { _state.value = _state.value.copy(loading = false, recurring = it) }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }
    fun saveRecurring(id: String?, input: RecurringInput, done: () -> Unit) = viewModelScope.launch { _state.value = _state.value.copy(loading = true); runCatching { if (id == null) repository.addRecurring(input) else repository.updateRecurring(id, input) }.onSuccess { loadRecurring(); done() }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }
    fun toggleRecurring(id: String) = viewModelScope.launch { runCatching { repository.toggleRecurring(id); repository.recurring() }.onSuccess { _state.value = _state.value.copy(recurring = it) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) } }
    fun deleteRecurring(id: String) = viewModelScope.launch { runCatching { repository.deleteRecurring(id); repository.recurring() }.onSuccess { _state.value = _state.value.copy(recurring = it) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) } }
    fun loadInvestments() = viewModelScope.launch { _state.value = _state.value.copy(loading = true); runCatching { repository.stocks() to repository.deposits() }.onSuccess { _state.value = _state.value.copy(loading = false, stocks = it.first, deposits = it.second) }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }
    fun addStock(input: StockInput, done: () -> Unit) = viewModelScope.launch { _state.value = _state.value.copy(loading = true); runCatching { repository.addStock(input) }.onSuccess { loadInvestments(); done() }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }
    fun stockAction(id: String, sell: Boolean) = viewModelScope.launch { runCatching { if (sell) repository.sellStock(id) else repository.deleteStock(id); repository.stocks() }.onSuccess { _state.value = _state.value.copy(stocks = it) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) } }
    fun refreshStocks() = viewModelScope.launch { _state.value = _state.value.copy(loading = true); runCatching { repository.refreshStocks(); repository.stocks() }.onSuccess { _state.value = _state.value.copy(loading = false, stocks = it) }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }
    fun addDeposit(input: DepositInput, done: () -> Unit) = viewModelScope.launch { _state.value = _state.value.copy(loading = true); runCatching { repository.addDeposit(input) }.onSuccess { loadInvestments(); done() }.onFailure { _state.value = _state.value.copy(loading = false, error = it.userMessage()) } }
    fun depositAction(id: String, withdraw: Boolean) = viewModelScope.launch { runCatching { if (withdraw) repository.withdrawDeposit(id) else repository.breakDeposit(id); repository.deposits() }.onSuccess { _state.value = _state.value.copy(deposits = it) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) } }

    fun loadImportCompanies() = viewModelScope.launch { runCatching { repository.importCompanies() to repository.categories() }.onSuccess { _state.value = _state.value.copy(importCompanies = it.first, categories = it.second) }.onFailure { _state.value = _state.value.copy(error = it.userMessage()) } }
    fun runAutomaticImport(company: String, startDate: String, incomesOnly: Boolean, fields: Map<String, String>) = viewModelScope.launch {
        _state.value = _state.value.copy(importStage = "loading", importMessage = "מתחבר ומושך נתונים…", error = null)
        runCatching { repository.scrape(company, startDate, incomesOnly, fields) }.onSuccess(::handleImportPreview).onFailure { _state.value = _state.value.copy(importStage = "credentials", error = it.userMessage()) }
    }
    fun startOneZeroOtp(phone: String) = viewModelScope.launch { _state.value = _state.value.copy(importStage = "loading", error = null); runCatching { repository.oneZeroStart(phone) }.onSuccess { _state.value = _state.value.copy(importStage = "onezero-otp", otpContext = it.otpContext) }.onFailure { _state.value = _state.value.copy(importStage = "credentials", error = it.userMessage()) } }
    fun verifyOneZeroOtp(code: String, email: String, password: String, startDate: String, incomesOnly: Boolean) = viewModelScope.launch { val context = _state.value.otpContext ?: return@launch; _state.value = _state.value.copy(importStage = "loading", error = null); runCatching { repository.oneZeroVerify(context, code, email, password, startDate, incomesOnly) }.onSuccess(::handleImportPreview).onFailure { _state.value = _state.value.copy(importStage = "onezero-otp", error = it.userMessage()) } }
    fun startCalOtp(id: String, last4: String) = viewModelScope.launch { _state.value = _state.value.copy(importStage = "loading", error = null); runCatching { repository.calStart(id, last4) }.onSuccess { _state.value = _state.value.copy(importStage = "cal-otp", importMessage = it.maskedPhone) }.onFailure { _state.value = _state.value.copy(importStage = "credentials", error = it.userMessage()) } }
    fun verifyCalOtp(id: String, last4: String, code: String, startDate: String) = viewModelScope.launch { _state.value = _state.value.copy(importStage = "loading", error = null); runCatching { repository.calVerify(id, last4, code, startDate) }.onSuccess(::handleImportPreview).onFailure { _state.value = _state.value.copy(importStage = "cal-otp", error = it.userMessage()) } }
    private fun handleImportPreview(preview: ImportPreview) { _state.value = _state.value.copy(importPreview = preview, importStage = if (preview.unseenMerchants.isEmpty()) "preview" else "mapping", importMessage = "נמצאו ${preview.transactions.size} תנועות") }
    fun commitImport(mappings: List<ImportMapping>) = viewModelScope.launch {
        val preview = _state.value.importPreview ?: return@launch
        val byMerchant = mappings.associateBy { it.originalName }
        val categoryNames = _state.value.categories.associate { it.id to it.name }
        val finalTransactions = preview.transactions.map { transaction ->
            val original = transaction["rawDescription"]?.jsonPrimitive?.contentOrNull
                ?: transaction["description"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val mapping = byMerchant[original] ?: return@map transaction
            buildJsonObject {
                transaction.forEach { (key, value) -> put(key, value) }
                put("description", mapping.newName)
                mapping.category?.let(categoryNames::get)?.let { put("category", it) }
            }
        }
        _state.value = _state.value.copy(importStage = "processing", error = null)
        runCatching { repository.processImport(finalTransactions, mappings) }
            .onSuccess { _state.value = _state.value.copy(importStage = "result", importMessage = it.message); loadTransactions(); loadDashboard() }
            .onFailure { _state.value = _state.value.copy(importStage = "preview", error = it.userMessage()) }
    }
    fun resetImport() { _state.value = _state.value.copy(importPreview = null, importStage = "credentials", importMessage = null, otpContext = null, error = null) }

    fun clearError() { _state.value = _state.value.copy(error = null) }
}

private fun Throwable.userMessage(): String = when (this) {
    is HttpException -> when (code()) { 401 -> "האימייל או הסיסמה אינם נכונים"; 423 -> "החשבון נעול זמנית"; else -> "שגיאת שרת (${code()})" }
    is java.net.ConnectException -> "לא ניתן להתחבר לשרת. האם השרת פועל?"
    else -> message ?: "משהו השתבש"
}
