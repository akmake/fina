package com.fina.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun CategoriesScreen(vm: FinaViewModel, state: FinaState, back: () -> Unit) {
    var addOpen by remember { mutableStateOf(false) }; var deleting by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { if (state.categories.isEmpty()) vm.loadTransactions() }
    Scaffold(topBar = { TopAppBar(title = { Text("קטגוריות", fontWeight = FontWeight.Bold) }, navigationIcon = { IconButton(back) { Icon(Icons.Default.ArrowBack, "חזרה") } }, actions = { IconButton(vm::syncCategories) { Icon(Icons.Default.Sync, "סנכרון מעסקאות") } }) }, floatingActionButton = { ExtendedFloatingActionButton(onClick = { addOpen = true }, icon = { Icon(Icons.Default.Add, null) }, text = { Text("קטגוריה חדשה") }) }) { padding ->
        LazyColumn(Modifier.padding(padding).fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 100.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(state.categories, key = { it.id }) { category ->
                Card(shape = RoundedCornerShape(22.dp)) { Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(12.dp).background(runCatching { Color(android.graphics.Color.parseColor(category.color)) }.getOrDefault(Color.Gray), CircleShape)); Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(category.name, fontWeight = FontWeight.SemiBold); Text(if (category.type.contains("הכנס")) "הכנסה" else "הוצאה", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; IconButton({ deleting = category.id }) { Icon(Icons.Default.DeleteOutline, "מחיקה") } } }
            }
        }
    }
    if (addOpen) AddCategoryDialog({ addOpen = false }) { name, type -> vm.addCategory(name, type) { addOpen = false } }
    deleting?.let { id -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("מחיקת קטגוריה") }, text = { Text("חוקי סיווג שמשתמשים בקטגוריה יימחקו גם הם.") }, confirmButton = { TextButton({ vm.deleteCategory(id); deleting = null }) { Text("מחיקה", color = MaterialTheme.colorScheme.error) } }, dismissButton = { TextButton({ deleting = null }) { Text("ביטול") } }) }
}

@Composable private fun AddCategoryDialog(dismiss: () -> Unit, save: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }; var income by remember { mutableStateOf(false) }
    AlertDialog(onDismissRequest = dismiss, title = { Text("קטגוריה חדשה") }, text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { OutlinedTextField(name, { name = it }, label = { Text("שם") }, singleLine = true); Row(verticalAlignment = Alignment.CenterVertically) { Text("קטגוריית הכנסה", Modifier.weight(1f)); Switch(income, { income = it }) } } }, confirmButton = { Button({ save(name.trim(), if (income) "income" else "expense") }, enabled = name.isNotBlank()) { Text("שמירה") } }, dismissButton = { TextButton(dismiss) { Text("ביטול") } })
}
