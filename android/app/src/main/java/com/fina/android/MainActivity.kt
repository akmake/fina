package com.fina.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fina.android.data.model.DashboardResponse
import com.fina.android.data.repository.FinaRepository
import com.fina.android.ui.FinaViewModel
import com.fina.android.ui.AppShell
import com.fina.android.ui.theme.FinaTheme
import java.text.NumberFormat
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); enableEdgeToEdge()
        val repository = FinaRepository.create(applicationContext)
        setContent {
            FinaTheme {
                CompositionLocalProvider(LocalLayoutDirection provides androidx.compose.ui.unit.LayoutDirection.Rtl) {
                    val vm: FinaViewModel = viewModel { FinaViewModel(repository) }
                    val state by vm.state.collectAsStateWithLifecycle()
                    Surface(Modifier.fillMaxSize()) {
                        when {
                            state.checkingSession -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                            state.user == null -> LoginScreen(state.loading, state.error, vm::login, vm::register, vm::clearError)
                            else -> AppShell(vm, state)
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun LoginScreen(loading: Boolean, error: String?, login: (String, String) -> Unit, register: (String, String, String, String) -> Unit, clearError: () -> Unit) {
    var isRegister by remember { mutableStateOf(false) }; var name by remember { mutableStateOf("") }; var email by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }; var confirmation by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Card(Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(4.dp)) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Icon(Icons.Default.AccountBalanceWallet, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(44.dp))
                Text(if (isRegister) "יצירת חשבון" else "ברוכים הבאים ל־Fina", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Text(if (isRegister) "מתחילים לנהל את התמונה הפיננסית במקום אחד." else "כל הכספים שלך, עכשיו גם בכיס.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (isRegister) OutlinedTextField(name, { name = it; clearError() }, label = { Text("שם מלא") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(email, { email = it; clearError() }, label = { Text("אימייל") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(password, { password = it; clearError() }, label = { Text("סיסמה") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
                if (isRegister) OutlinedTextField(confirmation, { confirmation = it; clearError() }, label = { Text("אימות סיסמה") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Button({ if (isRegister) register(name, email, password, confirmation) else login(email, password) }, enabled = !loading, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    if (loading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp) else Text(if (isRegister) "הרשמה" else "התחברות")
                }
                TextButton({ isRegister = !isRegister; clearError() }, Modifier.align(Alignment.CenterHorizontally)) { Text(if (isRegister) "כבר יש לי חשבון" else "אין לי חשבון — הרשמה") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun DashboardScreen(name: String, data: DashboardResponse?, loading: Boolean, error: String?, refresh: () -> Unit, logout: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("שלום ${name.ifBlank { "לך" }} 👋") }, actions = {
        IconButton(refresh) { Icon(Icons.Default.Refresh, "רענון") }; IconButton(logout) { Icon(Icons.AutoMirrored.Filled.Logout, "התנתקות") }
    }) }) { padding ->
        Column(Modifier.padding(padding).padding(16.dp).fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (loading && data == null) LinearProgressIndicator(Modifier.fillMaxWidth())
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            data?.let { dashboard ->
                val month = dashboard.monthlySummary.thisMonth
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SummaryCard("הכנסות", money(month.income), MaterialTheme.colorScheme.secondary, Modifier.weight(1f))
                    SummaryCard("הוצאות", money(month.expense), MaterialTheme.colorScheme.error, Modifier.weight(1f))
                }
                SummaryCard("יתרה בחשבונות", money(dashboard.accounts.sumOf { it.balance }), MaterialTheme.colorScheme.primary, Modifier.fillMaxWidth())
                Text("פעולות אחרונות", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                if (dashboard.recentTransactions.isEmpty()) Text("עוד אין תנועות להצגה", color = MaterialTheme.colorScheme.onSurfaceVariant)
                dashboard.recentTransactions.take(6).forEach { tx ->
                    ListItem(headlineContent = { Text(tx.description.ifBlank { tx.merchant.ifBlank { tx.category.ifBlank { "תנועה" } } }) },
                        supportingContent = { Text(tx.category) }, trailingContent = { Text(money(tx.amount), fontWeight = FontWeight.SemiBold) })
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable private fun SummaryCard(title: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier) {
    Card(modifier) { Column(Modifier.padding(16.dp)) { Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.height(6.dp)); Text(value, color = color, fontWeight = FontWeight.Bold, fontSize = 21.sp) } }
}

private fun money(value: Double): String = NumberFormat.getCurrencyInstance(Locale("he", "IL")).format(value)
