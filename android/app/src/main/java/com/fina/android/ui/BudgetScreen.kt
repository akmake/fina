package com.fina.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fina.android.data.model.BudgetInput
import com.fina.android.data.model.BudgetItem
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun BudgetScreen(vm: FinaViewModel, state: FinaState) {
    var date by remember { mutableStateOf(LocalDate.now().withDayOfMonth(1)) }
    val limits = remember { mutableStateMapOf<String, String>() }
    var notes by remember { mutableStateOf("") }
    var threshold by remember { mutableFloatStateOf(80f) }

    LaunchedEffect(date) { vm.loadBudget(date.monthValue, date.year) }
    LaunchedEffect(state.budget) {
        limits.clear(); state.budget?.budget?.items?.forEach { limits[it.category] = it.limit.toString() }
        notes = state.budget?.budget?.notes.orEmpty(); threshold = (state.budget?.budget?.alertThreshold ?: 80).toFloat()
    }

    Scaffold(topBar = { CenterAlignedTopAppBar(title = { Text("תקציב חודשי", fontWeight = FontWeight.Bold) }) }) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Card(shape = RoundedCornerShape(26.dp)) {
                    Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        IconButton({ date = date.minusMonths(1) }) { Icon(Icons.Default.ChevronRight, "חודש קודם") }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(date.month.getDisplayName(TextStyle.FULL, Locale("he")), fontWeight = FontWeight.Bold, fontSize = 20.sp); Text(date.year.toString(), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        IconButton({ date = date.plusMonths(1) }) { Icon(Icons.Default.ChevronLeft, "חודש הבא") }
                    }
                }
                Spacer(Modifier.height(12.dp))
                val budget = state.budget?.budget
                val totalLimit = limits.values.sumOf { it.toDoubleOrNull() ?: 0.0 }
                val spent = budget?.totalSpent ?: 0.0
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary), shape = RoundedCornerShape(28.dp)) {
                    Column(Modifier.padding(22.dp)) {
                        Text("נוצל החודש", color = Color.White.copy(.75f)); Text("${money(spent)} מתוך ${money(totalLimit)}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                        Spacer(Modifier.height(14.dp)); LinearProgressIndicator(progress = { if (totalLimit > 0) (spent / totalLimit).coerceIn(0.0, 1.0).toFloat() else 0f }, modifier = Modifier.fillMaxWidth().height(8.dp), color = Color.White, trackColor = Color.White.copy(.2f))
                    }
                }
                Spacer(Modifier.height(10.dp)); Text("תקציב לפי קטגוריה", fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
            if (state.loading && state.budget == null) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            items(state.categories.filterNot { it.type.contains("הכנס") }, key = { it.id }) { category ->
                val spent = state.budget?.spending?.get(category.name) ?: 0.0
                val limit = limits[category.name]?.toDoubleOrNull() ?: 0.0
                Card(shape = RoundedCornerShape(22.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text(category.name, fontWeight = FontWeight.SemiBold); Text("נוצל ${money(spent)}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }; OutlinedTextField(limits[category.name].orEmpty(), { limits[category.name] = it }, label = { Text("תקרה") }, prefix = { Text("₪") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.width(130.dp), shape = RoundedCornerShape(16.dp)) }
                        if (limit > 0) { Spacer(Modifier.height(8.dp)); LinearProgressIndicator(progress = { (spent / limit).coerceIn(0.0, 1.0).toFloat() }, modifier = Modifier.fillMaxWidth(), color = if (spent > limit) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary) }
                    }
                }
            }
            item {
                Text("התראה ב־${threshold.toInt()}%", fontWeight = FontWeight.SemiBold); Slider(threshold, { threshold = it }, valueRange = 50f..100f, steps = 9)
                OutlinedTextField(notes, { notes = it }, label = { Text("הערות") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp))
                Spacer(Modifier.height(12.dp))
                val items = limits.mapNotNull { (category, raw) -> raw.toDoubleOrNull()?.takeIf { it > 0 }?.let { BudgetItem(category = category, limit = it) } }
                Button({ vm.saveBudget(BudgetInput(date.monthValue, date.year, items.sumOf { it.limit }, items, threshold.toInt(), notes)) }, enabled = items.isNotEmpty() && !state.loading, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(18.dp)) { Text("שמירת התקציב", fontWeight = FontWeight.Bold) }
                state.budget?.budget?.let { budget -> TextButton({ vm.deleteBudget(budget.id, date.monthValue, date.year) }, Modifier.fillMaxWidth()) { Text("מחיקת התקציב", color = MaterialTheme.colorScheme.error) } }
            }
        }
    }
}

private fun money(value: Double) = NumberFormat.getCurrencyInstance(Locale("he", "IL")).format(value)
