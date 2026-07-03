package com.fina.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fina.android.DashboardScreen
import com.fina.android.data.model.Transaction
import com.fina.android.data.model.TransactionInput
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class MainTab(val title: String, val icon: ImageVector) {
    HOME("ראשי", Icons.Default.Home), TRANSACTIONS("תנועות", Icons.Default.ReceiptLong), BUDGET("תקציב", Icons.Default.AccountBalanceWallet), INVESTMENTS("השקעות", Icons.Default.TrendingUp), MORE("עוד", Icons.Default.GridView)
}

@Composable fun AppShell(vm: FinaViewModel, state: FinaState) {
    var tab by remember { mutableStateOf(MainTab.HOME) }
    var moreRoute by remember { mutableStateOf<String?>(null) }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .96f), tonalElevation = 0.dp) {
                MainTab.entries.forEach { item ->
                    NavigationBarItem(selected = tab == item, onClick = { tab = item; if (item != MainTab.MORE) moreRoute = null }, icon = { Icon(item.icon, item.title) }, label = { Text(item.title, fontSize = 10.sp) })
                }
            }
        }
    ) { padding ->
        Box(Modifier.padding(bottom = padding.calculateBottomPadding())) {
            when (tab) {
                MainTab.HOME -> DashboardScreen(state.user?.name.orEmpty(), state.dashboard, state.loading, state.error, vm::loadDashboard, vm::logout)
                MainTab.TRANSACTIONS -> TransactionsScreen(vm, state)
                MainTab.BUDGET -> BudgetScreen(vm, state)
                MainTab.INVESTMENTS -> InvestmentsScreen(vm, state)
                MainTab.MORE -> when (moreRoute) {
                    "קטגוריות" -> CategoriesScreen(vm, state) { moreRoute = null }
                    "קבועים" -> RecurringScreen(vm, state) { moreRoute = null }
                    "פרופיל" -> ProfileScreen(vm, state) { moreRoute = null }
                    "ייבוא אוטומטי" -> AutoImportScreen(vm, state) { moreRoute = null }
                    else -> MoreScreen(state.user?.role == "admin", onOpen = { moreRoute = it }, onLogout = vm::logout)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun TransactionsScreen(vm: FinaViewModel, state: FinaState) {
    var editor by remember { mutableStateOf<Transaction?>(null) }
    var adding by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<Transaction?>(null) }
    LaunchedEffect(Unit) { if (!state.transactionsLoaded) vm.loadTransactions() }

    Scaffold(
        topBar = { CenterAlignedTopAppBar(title = { Text("תנועות", fontWeight = FontWeight.Bold) }, actions = { IconButton(vm::loadTransactions) { Icon(Icons.Default.Refresh, "רענון") } }) },
        floatingActionButton = { ExtendedFloatingActionButton(onClick = { adding = true }, icon = { Icon(Icons.Default.Add, null) }, text = { Text("פעולה חדשה") }, shape = CircleShape) }
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 100.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                OutlinedTextField(state.transactionQuery, { vm.filterTransactions(query = it) }, modifier = Modifier.fillMaxWidth(), placeholder = { Text("חיפוש בכל ההיסטוריה") }, leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true, shape = RoundedCornerShape(22.dp))
                Spacer(Modifier.height(10.dp))
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf(null to "הכול", "expense" to "הוצאות", "income" to "הכנסות").forEachIndexed { index, pair ->
                        SegmentedButton(selected = state.transactionType == pair.first, onClick = { vm.filterTransactions(type = pair.first) }, shape = SegmentedButtonDefaults.itemShape(index, 3)) { Text(pair.second) }
                    }
                }
                Spacer(Modifier.height(8.dp))
                val income = state.transactions.filter { it.type.contains("הכנס") }.sumOf { it.amount }
                val expense = state.transactions.filterNot { it.type.contains("הכנס") }.sumOf { it.amount }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { MiniMetric("הכנסות", income, Color(0xFF0F9F6E), Modifier.weight(1f)); MiniMetric("הוצאות", expense, Color(0xFFE5484D), Modifier.weight(1f)) }
            }
            if (state.loading && state.transactions.isEmpty()) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            if (!state.loading && state.transactions.isEmpty()) item { EmptyState("לא נמצאו תנועות", "אפשר להוסיף פעולה חדשה או לשנות את החיפוש") }
            items(state.transactions, key = { it.id }) { transaction ->
                TransactionRow(transaction, onEdit = { editor = transaction }, onDelete = { deleting = transaction })
            }
        }
    }
    if (adding || editor != null) TransactionEditor(editor, state.categories.map { it.name }, state.loading, onDismiss = { adding = false; editor = null }) { input -> vm.saveTransaction(editor?.id, input) { adding = false; editor = null } }
    deleting?.let { tx -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("למחוק את הפעולה?") }, text = { Text("המחיקה תעדכן גם את יתרת החשבון.") }, confirmButton = { TextButton({ vm.deleteTransaction(tx.id); deleting = null }) { Text("מחיקה", color = MaterialTheme.colorScheme.error) } }, dismissButton = { TextButton({ deleting = null }) { Text("ביטול") } }) }
}

@Composable private fun TransactionRow(tx: Transaction, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onEdit), shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).background(if (tx.type.contains("הכנס")) Color(0xFFE4F7EF) else Color(0xFFFFECEC), CircleShape), contentAlignment = Alignment.Center) { Icon(if (tx.type.contains("הכנס")) Icons.Default.SouthWest else Icons.Default.NorthEast, null, tint = if (tx.type.contains("הכנס")) Color(0xFF0F9F6E) else Color(0xFFE5484D)) }
            Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(tx.description.ifBlank { "ללא תיאור" }, fontWeight = FontWeight.SemiBold); Text(listOf(tx.category, tx.date.take(10)).filter { it.isNotBlank() }.joinToString(" · "), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Text((if (tx.type.contains("הכנס")) "+" else "−") + money(tx.amount), fontWeight = FontWeight.Bold, color = if (tx.type.contains("הכנס")) Color(0xFF0F9F6E) else MaterialTheme.colorScheme.onSurface)
            IconButton(onDelete) { Icon(Icons.Default.DeleteOutline, "מחיקה", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun TransactionEditor(existing: Transaction?, categories: List<String>, saving: Boolean, onDismiss: () -> Unit, onSave: (TransactionInput) -> Unit) {
    var description by remember(existing) { mutableStateOf(existing?.description.orEmpty()) }; var amount by remember(existing) { mutableStateOf(existing?.amount?.toString().orEmpty()) }
    var date by remember(existing) { mutableStateOf(existing?.date?.take(10) ?: LocalDate.now().toString()) }; var type by remember(existing) { mutableStateOf(existing?.type ?: "הוצאה") }
    var category by remember(existing) { mutableStateOf(existing?.category.orEmpty()) }; var account by remember(existing) { mutableStateOf(existing?.account ?: "checking") }
    var categoryOpen by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)) {
        Column(Modifier.fillMaxWidth().padding(24.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(if (existing == null) "פעולה חדשה" else "עריכת פעולה", fontSize = 26.sp, fontWeight = FontWeight.Bold)
            OutlinedTextField(description, { description = it }, label = { Text("תיאור") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(amount, { amount = it }, label = { Text("סכום") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(18.dp))
                OutlinedTextField(date, { date = it }, label = { Text("תאריך") }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(18.dp))
            }
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) { listOf("הוצאה", "הכנסה").forEachIndexed { i, value -> SegmentedButton(type == value, { type = value }, SegmentedButtonDefaults.itemShape(i, 2)) { Text(value) } } }
            ExposedDropdownMenuBox(categoryOpen, { categoryOpen = it }) { OutlinedTextField(category, {}, readOnly = true, label = { Text("קטגוריה") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(categoryOpen) }, modifier = Modifier.menuAnchor().fillMaxWidth(), shape = RoundedCornerShape(18.dp)); ExposedDropdownMenu(categoryOpen, { categoryOpen = false }) { categories.forEach { DropdownMenuItem({ Text(it) }, { category = it; categoryOpen = false }) } } }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { FilterChip(account == "checking", { account = "checking" }, { Text("עו״ש") }); FilterChip(account == "cash", { account = "cash" }, { Text("מזומן") }) }
            Button(onClick = { onSave(TransactionInput(date, description.trim(), amount.toDoubleOrNull() ?: 0.0, type, category.ifBlank { "כללי" }, account)) }, enabled = !saving && description.isNotBlank() && (amount.toDoubleOrNull() ?: 0.0) > 0, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(18.dp)) { if (saving) CircularProgressIndicator(Modifier.size(22.dp)) else Text("שמירה", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable private fun MiniMetric(label: String, value: Double, color: Color, modifier: Modifier) { Card(modifier, shape = RoundedCornerShape(20.dp)) { Column(Modifier.padding(14.dp)) { Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(money(value), fontWeight = FontWeight.Bold, fontSize = 18.sp, color = color) } } }
@Composable private fun EmptyState(title: String, subtitle: String) { Column(Modifier.fillMaxWidth().padding(vertical = 64.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Default.ReceiptLong, null, Modifier.size(52.dp), tint = MaterialTheme.colorScheme.outline); Spacer(Modifier.height(12.dp)); Text(title, fontWeight = FontWeight.Bold); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
@Composable private fun ModuleLanding(title: String, subtitle: String, icon: ImageVector) { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(icon, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary); Text(title, fontSize = 28.sp, fontWeight = FontWeight.Bold); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant) } } }

@Composable private fun MoreScreen(admin: Boolean, onOpen: (String) -> Unit, onLogout: () -> Unit) {
    val groups = listOf(
        "חשבון" to listOf("פרופיל"),
        "כספים" to listOf("קטגוריות", "קבועים"),
        "ייבוא" to listOf("ייבוא אוטומטי")
    )
    LazyColumn(contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 100.dp)) { item { Text("כל הכלים", fontSize = 30.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(20.dp)) }; groups.forEach { (title, entries) -> item { Text(title, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(vertical = 10.dp)) }; items(entries) { entry -> ListItem(headlineContent = { Text(entry) }, leadingContent = { Icon(Icons.Default.ChevronLeft, null) }, modifier = Modifier.clickable { onOpen(entry) }, colors = ListItemDefaults.colors(containerColor = Color.Transparent)) } }; item { TextButton(onLogout, Modifier.fillMaxWidth()) { Text("התנתקות", color = MaterialTheme.colorScheme.error) } } }
}
private fun money(value: Double) = NumberFormat.getCurrencyInstance(Locale("he", "IL")).format(value)
