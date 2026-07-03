package com.fina.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun ProfileScreen(vm: FinaViewModel, state: FinaState, back: () -> Unit) {
    var name by remember(state.user?.name) { mutableStateOf(state.user?.name.orEmpty()) }; var passwordOpen by remember { mutableStateOf(false) }; var saved by remember { mutableStateOf(false) }
    Scaffold(topBar = { TopAppBar(title = { Text("הפרופיל שלי", fontWeight = FontWeight.Bold) }, navigationIcon = { IconButton(back) { Icon(Icons.Default.ArrowBack, "חזרה") } }) }) { padding ->
        Column(Modifier.padding(padding).padding(20.dp).fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Surface(Modifier.size(92.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primary) { Box(contentAlignment = Alignment.Center) { Text(state.user?.name?.trim()?.split(" ")?.mapNotNull { it.firstOrNull()?.toString() }?.take(2)?.joinToString("") ?: "U", color = MaterialTheme.colorScheme.onPrimary, fontSize = 30.sp, fontWeight = FontWeight.Bold) } }
            Text(state.user?.email.orEmpty(), color = MaterialTheme.colorScheme.onSurfaceVariant)
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp)) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("פרטים אישיים", fontWeight = FontWeight.Bold, fontSize = 19.sp); OutlinedTextField(name, { name = it; saved = false }, label = { Text("שם מלא") }, leadingIcon = { Icon(Icons.Default.Person, null) }, modifier = Modifier.fillMaxWidth(), singleLine = true); Button({ vm.updateProfile(name.trim()) { saved = true } }, enabled = name.isNotBlank() && name != state.user?.name && !state.loading, modifier = Modifier.fillMaxWidth()) { Text("שמירת השם") }; if (saved) Text("השם עודכן", color = MaterialTheme.colorScheme.primary) } }
            Card(onClick = { passwordOpen = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp)) { ListItem(headlineContent = { Text("שינוי סיסמה", fontWeight = FontWeight.SemiBold) }, supportingContent = { Text("עדכון מאובטח של סיסמת החשבון") }, leadingContent = { Icon(Icons.Default.Lock, null) }) }
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
    if (passwordOpen) PasswordDialog(state.loading, { passwordOpen = false }) { current, next, confirm -> vm.changePassword(current, next, confirm) { passwordOpen = false } }
}

@Composable private fun PasswordDialog(loading: Boolean, dismiss: () -> Unit, save: (String, String, String) -> Unit) {
    var current by remember { mutableStateOf("") }; var next by remember { mutableStateOf("") }; var confirm by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = dismiss, title = { Text("שינוי סיסמה") }, text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { PasswordField(current, { current = it }, "סיסמה נוכחית"); PasswordField(next, { next = it }, "סיסמה חדשה"); PasswordField(confirm, { confirm = it }, "אימות סיסמה") } }, confirmButton = { Button({ save(current, next, confirm) }, enabled = current.isNotBlank() && next.length >= 8 && confirm == next && !loading) { Text("עדכון") } }, dismissButton = { TextButton(dismiss) { Text("ביטול") } })
}
@Composable private fun PasswordField(value: String, change: (String) -> Unit, label: String) = OutlinedTextField(value, change, label = { Text(label) }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
