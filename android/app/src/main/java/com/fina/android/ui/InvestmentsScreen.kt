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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fina.android.data.model.DepositInput
import com.fina.android.data.model.StockInput
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun InvestmentsScreen(vm: FinaViewModel, state: FinaState) {
    var section by remember { mutableIntStateOf(0) }; var addStock by remember { mutableStateOf(false) }; var addDeposit by remember { mutableStateOf(false) }; var confirm by remember { mutableStateOf<Pair<String, Boolean>?>(null) }
    LaunchedEffect(Unit) { vm.loadInvestments() }
    Scaffold(topBar = { CenterAlignedTopAppBar(title = { Text("השקעות וחיסכון", fontWeight = FontWeight.Bold) }, actions = { IconButton(vm::refreshStocks) { Icon(Icons.Default.Refresh, "רענון שערים") } }) }, floatingActionButton = { FloatingActionButton({ if (section == 0) addStock = true else addDeposit = true }, shape = CircleShape) { Icon(Icons.Default.Add, "הוספה") } }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            TabRow(section) { Tab(section == 0, { section = 0 }, text = { Text("מניות") }, icon = { Icon(Icons.Default.ShowChart, null) }); Tab(section == 1, { section = 1 }, text = { Text("פיקדונות") }, icon = { Icon(Icons.Default.Savings, null) }) }
            LazyColumn(contentPadding = PaddingValues(16.dp, 14.dp, 16.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (section == 0) {
                    item { PortfolioHero("שווי תיק המניות", state.stocks.sumOf { it.currentValueILS }, state.stocks.sumOf { it.currentValueILS - it.investedAmount }) }
                    items(state.stocks, key = { it.id }) { stock ->
                        Card(shape = RoundedCornerShape(24.dp)) { Column(Modifier.padding(16.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) { Text(stock.ticker.take(3), fontWeight = FontWeight.Black) }; Column(Modifier.weight(1f)) { Text(stock.ticker, fontWeight = FontWeight.Bold, fontSize = 18.sp); Text("${stock.shares.format(3)} יחידות · $${stock.currentPrice.format(2)}", style = MaterialTheme.typography.labelSmall) }; Text(money(stock.currentValueILS), fontWeight = FontWeight.Bold) }; HorizontalDivider(Modifier.padding(vertical = 10.dp)); Row { Text("רווח: ${money(stock.currentValueILS - stock.investedAmount)}", color = if (stock.currentValueILS >= stock.investedAmount) Color(0xFF0F9F6E) else MaterialTheme.colorScheme.error, modifier = Modifier.weight(1f)); TextButton({ confirm = stock.id to true }) { Text("מכירה") }; IconButton({ confirm = stock.id to false }) { Icon(Icons.Default.DeleteOutline, "מחיקה") } } } }
                    }
                    if (!state.loading && state.stocks.isEmpty()) item { EmptyInvestments("אין מניות בתיק") }
                } else {
                    item { PortfolioHero("סך הפיקדונות", state.deposits.sumOf { it.principal }, state.deposits.sumOf { it.futureValue - it.principal }) }
                    items(state.deposits, key = { it.id }) { deposit ->
                        Card(shape = RoundedCornerShape(24.dp)) { Column(Modifier.padding(18.dp)) { Row { Column(Modifier.weight(1f)) { Text(deposit.name, fontWeight = FontWeight.Bold, fontSize = 18.sp); Text("${deposit.annualInterestRate}% שנתי", color = MaterialTheme.colorScheme.primary) }; Text(money(deposit.principal), fontWeight = FontWeight.Bold) }; Spacer(Modifier.height(10.dp)); Text("פדיון ${deposit.endDate.take(10)} · שווי צפוי ${money(deposit.futureValue)}", style = MaterialTheme.typography.labelMedium); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { TextButton({ vm.depositAction(deposit.id, false) }) { Text("שבירה", color = MaterialTheme.colorScheme.error) }; Button({ vm.depositAction(deposit.id, true) }) { Text("משיכה") } } } }
                    }
                    if (!state.loading && state.deposits.isEmpty()) item { EmptyInvestments("אין פיקדונות פעילים") }
                }
                if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            }
        }
    }
    if (addStock) StockDialog({ addStock = false }, state.loading) { vm.addStock(it) { addStock = false } }
    if (addDeposit) DepositDialog({ addDeposit = false }, state.loading) { vm.addDeposit(it) { addDeposit = false } }
    confirm?.let { (id, sell) -> AlertDialog(onDismissRequest = { confirm = null }, title = { Text(if (sell) "מכירת המניה" else "הסרת המניה") }, text = { Text(if (sell) "השווי הנוכחי יועבר לחשבון העו״ש." else "הפריט יוסר ללא שינוי ביתרות.") }, confirmButton = { Button({ vm.stockAction(id, sell); confirm = null }) { Text("אישור") } }, dismissButton = { TextButton({ confirm = null }) { Text("ביטול") } }) }
}

@Composable private fun PortfolioHero(title: String, value: Double, profit: Double) { Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary), shape = RoundedCornerShape(28.dp)) { Column(Modifier.fillMaxWidth().padding(22.dp)) { Text(title, color = Color.White.copy(.7f)); Text(money(value), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 28.sp); Text("רווח משוער ${money(profit)}", color = Color.White.copy(.85f)) } } }
@Composable private fun EmptyInvestments(text: String) { Box(Modifier.fillMaxWidth().padding(60.dp), contentAlignment = Alignment.Center) { Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant) } }

@Composable private fun StockDialog(dismiss: () -> Unit, loading: Boolean, save: (StockInput) -> Unit) { var ticker by remember { mutableStateOf("") }; var price by remember { mutableStateOf("") }; var amount by remember { mutableStateOf("") }; AlertDialog(onDismissRequest = dismiss, title = { Text("הוספת מניה") }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Field(ticker, { ticker = it.uppercase() }, "סימול, למשל AAPL", false); Field(price, { price = it }, "מחיר רכישה בדולר", true); Field(amount, { amount = it }, "סכום השקעה בדולר", true) } }, confirmButton = { Button({ save(StockInput(ticker, price.toDoubleOrNull() ?: 0.0, amount.toDoubleOrNull() ?: 0.0)) }, enabled = ticker.isNotBlank() && price.toDoubleOrNull() != null && amount.toDoubleOrNull() != null && !loading) { Text("הוספה") } }, dismissButton = { TextButton(dismiss) { Text("ביטול") } }) }
@Composable private fun DepositDialog(dismiss: () -> Unit, loading: Boolean, save: (DepositInput) -> Unit) { var name by remember { mutableStateOf("") }; var principal by remember { mutableStateOf("") }; var interest by remember { mutableStateOf("") }; var months by remember { mutableStateOf("") }; AlertDialog(onDismissRequest = dismiss, title = { Text("פיקדון חדש") }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Field(name, { name = it }, "שם הפיקדון", false); Field(principal, { principal = it }, "קרן", true); Field(interest, { interest = it }, "ריבית שנתית %", true); Field(months, { months = it }, "משך בחודשים", true) } }, confirmButton = { Button({ save(DepositInput(name, principal.toDoubleOrNull() ?: 0.0, interest.toDoubleOrNull() ?: 0.0, LocalDate.now().toString(), months.toIntOrNull() ?: 1)) }, enabled = name.isNotBlank() && principal.toDoubleOrNull() != null && interest.toDoubleOrNull() != null && months.toIntOrNull() != null && !loading) { Text("יצירה") } }, dismissButton = { TextButton(dismiss) { Text("ביטול") } }) }
@Composable private fun Field(value: String, change: (String) -> Unit, label: String, number: Boolean) { OutlinedTextField(value, change, label = { Text(label) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = if (number) KeyboardType.Decimal else KeyboardType.Text), modifier = Modifier.fillMaxWidth()) }
private fun money(v: Double) = NumberFormat.getCurrencyInstance(Locale("he", "IL")).format(v)
private fun Double.format(n: Int) = String.format(Locale.US, "%.${n}f", this)
