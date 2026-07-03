package com.fina.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fina.android.data.model.RecurringInput
import com.fina.android.data.model.RecurringItem
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun RecurringScreen(vm: FinaViewModel, state: FinaState, back: () -> Unit) {
    var editor by remember { mutableStateOf<RecurringItem?>(null) }; var adding by remember { mutableStateOf(false) }; var deleting by remember { mutableStateOf<RecurringItem?>(null) }
    LaunchedEffect(Unit) { vm.loadRecurring() }
    Scaffold(topBar = { TopAppBar(title = { Text("תנועות קבועות", fontWeight = FontWeight.Bold) }, navigationIcon = { IconButton(back) { Icon(Icons.Default.ArrowBack, "חזרה") } }, actions = { IconButton(vm::loadRecurring) { Icon(Icons.Default.Refresh, "רענון") } }) }, floatingActionButton = { FloatingActionButton({ adding = true }, shape = CircleShape) { Icon(Icons.Default.Add, "הוספה") } }) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            state.recurring?.summary?.let { summary -> item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { RecurringMetric("הוצאות חודשיות", summary.totalMonthlyExpenses, Modifier.weight(1f)); RecurringMetric("הכנסות חודשיות", summary.totalMonthlyIncome, Modifier.weight(1f)) } } }
            if (state.loading && state.recurring == null) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            items(state.recurring?.transactions.orEmpty(), key = { it.id }) { item ->
                Card(onClick = { editor = item }, shape = RoundedCornerShape(24.dp)) { Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Icon(if (item.subcategory == "subscription") Icons.Default.Subscriptions else Icons.Default.Repeat, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(item.description, fontWeight = FontWeight.SemiBold); Text("${frequencyName(item.frequency)} · ${item.category}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(money(item.amount), fontWeight = FontWeight.Bold) }; Switch(!item.isPaused, { vm.toggleRecurring(item.id) }); IconButton({ deleting = item }) { Icon(Icons.Default.DeleteOutline, "מחיקה") } } }
            }
            if (!state.loading && state.recurring?.transactions.isNullOrEmpty()) item { Box(Modifier.fillMaxWidth().padding(64.dp), contentAlignment = Alignment.Center) { Text("אין עדיין תנועות קבועות") } }
        }
    }
    if (adding || editor != null) RecurringEditor(editor, state.categories.map { it.name }, state.loading, { adding = false; editor = null }) { input -> vm.saveRecurring(editor?.id, input) { adding = false; editor = null } }
    deleting?.let { item -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("למחוק את ${item.description}?") }, confirmButton = { TextButton({ vm.deleteRecurring(item.id); deleting = null }) { Text("מחיקה", color = MaterialTheme.colorScheme.error) } }, dismissButton = { TextButton({ deleting = null }) { Text("ביטול") } }) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun RecurringEditor(item: RecurringItem?, categories: List<String>, loading: Boolean, dismiss: () -> Unit, save: (RecurringInput) -> Unit) {
    var description by remember(item) { mutableStateOf(item?.description.orEmpty()) }; var amount by remember(item) { mutableStateOf(item?.amount?.toString().orEmpty()) }; var income by remember(item) { mutableStateOf(item?.type?.contains("הכנס") == true) }
    var category by remember(item) { mutableStateOf(item?.category ?: "כללי") }; var frequency by remember(item) { mutableStateOf(item?.frequency ?: "monthly") }; var day by remember(item) { mutableStateOf((item?.dayOfMonth ?: LocalDate.now().dayOfMonth).toString()) }; var provider by remember(item) { mutableStateOf(item?.provider.orEmpty()) }
    ModalBottomSheet(onDismissRequest = dismiss, shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)) { Column(Modifier.padding(24.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(if (item == null) "קבועה חדשה" else "עריכת קבועה", fontSize = 26.sp, fontWeight = FontWeight.Bold)
        OutlinedTextField(description, { description = it }, label = { Text("תיאור") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedTextField(amount, { amount = it }, label = { Text("סכום") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f)); OutlinedTextField(day, { day = it }, label = { Text("יום בחודש") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f)) }
        Row(verticalAlignment = Alignment.CenterVertically) { Text("הכנסה", Modifier.weight(1f)); Switch(income, { income = it }) }
        OutlinedTextField(category, { category = it }, label = { Text("קטגוריה") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(provider, { provider = it }, label = { Text("ספק") }, modifier = Modifier.fillMaxWidth())
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) { listOf("weekly" to "שבועי", "monthly" to "חודשי", "yearly" to "שנתי").forEachIndexed { i, pair -> SegmentedButton(frequency == pair.first, { frequency = pair.first }, SegmentedButtonDefaults.itemShape(i, 3)) { Text(pair.second) } } }
        Button({ save(RecurringInput(description, amount.toDoubleOrNull() ?: 0.0, if (income) "הכנסה" else "הוצאה", category, frequency = frequency, dayOfMonth = day.toIntOrNull()?.coerceIn(1,31), startDate = item?.startDate?.take(10) ?: LocalDate.now().toString(), provider = provider.ifBlank { null })) }, enabled = description.isNotBlank() && (amount.toDoubleOrNull() ?: 0.0) > 0 && !loading, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("שמירה") }
    } }
}
@Composable private fun RecurringMetric(label: String, value: Double, modifier: Modifier) { Card(modifier, shape = RoundedCornerShape(22.dp)) { Column(Modifier.padding(16.dp)) { Text(label, style = MaterialTheme.typography.labelMedium); Text(money(value), fontWeight = FontWeight.Bold, fontSize = 18.sp) } } }
private fun frequencyName(value: String) = mapOf("daily" to "יומי", "weekly" to "שבועי", "monthly" to "חודשי", "yearly" to "שנתי")[value] ?: value
private fun money(value: Double) = NumberFormat.getCurrencyInstance(Locale("he", "IL")).format(value)
