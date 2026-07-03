package com.fina.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fina.android.data.model.ImportMapping
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AutoImportScreen(vm: FinaViewModel, state: FinaState, back: () -> Unit) {
    var selected by remember { mutableStateOf("") }; val fields = remember { mutableStateMapOf<String, String>() }
    var startDate by remember { mutableStateOf(LocalDate.now().minusMonths(2).toString()) }; var incomesOnly by remember { mutableStateOf(false) }; var otp by remember { mutableStateOf("") }
    var calId by remember { mutableStateOf("") }; var calLast4 by remember { mutableStateOf("") }
    val mappings = remember { mutableStateMapOf<String, Pair<String, String?>>() }
    LaunchedEffect(Unit) { vm.loadImportCompanies() }
    LaunchedEffect(state.importCompanies) { if (selected.isBlank() && state.importCompanies.isNotEmpty()) { selected = state.importCompanies.first().value; incomesOnly = state.importCompanies.first().group.contains("בנק") } }
    LaunchedEffect(state.importPreview) { state.importPreview?.unseenMerchants?.forEach { if (it !in mappings) mappings[it] = it to null } }
    val company = state.importCompanies.find { it.value == selected }

    Scaffold(topBar = { TopAppBar(title = { Text("ייבוא אוטומטי", fontWeight = FontWeight.Bold) }, navigationIcon = { IconButton(back) { Icon(Icons.Default.ArrowBack, "חזרה") } }) }) { padding ->
        when (state.importStage) {
            "loading", "processing" -> ImportLoading(Modifier.padding(padding), state.importMessage ?: "מעבד נתונים…")
            "onezero-otp" -> OtpScreen(Modifier.padding(padding), "קוד האימות של One Zero", otp, { otp = it }, state.error, { vm.verifyOneZeroOtp(otp, fields["email"].orEmpty(), fields["password"].orEmpty(), startDate, incomesOnly) }, vm::resetImport)
            "cal-otp" -> OtpScreen(Modifier.padding(padding), "קוד האימות של כאל", otp, { otp = it }, state.error, { vm.verifyCalOtp(calId, calLast4, otp, startDate) }, vm::resetImport)
            "mapping" -> MappingScreen(Modifier.padding(padding), state, mappings) { vm.commitImport(mappings.map { (original, pair) -> ImportMapping(original, pair.first, pair.second) }) }
            "preview" -> PreviewScreen(Modifier.padding(padding), state, { vm.commitImport(emptyList()) }, vm::resetImport)
            "result" -> ResultScreen(Modifier.padding(padding), state.importMessage.orEmpty(), vm::resetImport)
            else -> CredentialsScreen(Modifier.padding(padding), state, company, selected, { selected = it; fields.clear(); incomesOnly = state.importCompanies.find { c -> c.value == it }?.group?.contains("בנק") == true }, fields, startDate, { startDate = it }, incomesOnly, { incomesOnly = it }, calId, { calId = it }, calLast4, { calLast4 = it }) {
                when {
                    selected == "visaCal" -> vm.startCalOtp(calId, calLast4)
                    company?.otpFlow == true -> vm.startOneZeroOtp(fields["phoneNumber"].orEmpty())
                    else -> vm.runAutomaticImport(selected, startDate, incomesOnly, fields)
                }
            }
        }
    }
}

@Composable private fun CredentialsScreen(modifier: Modifier, state: FinaState, company: com.fina.android.data.model.ImportCompany?, selected: String, select: (String) -> Unit, fields: MutableMap<String, String>, startDate: String, setDate: (String) -> Unit, incomesOnly: Boolean, setIncomes: (Boolean) -> Unit, calId: String, setCalId: (String) -> Unit, calLast4: String, setCalLast4: (String) -> Unit, submit: () -> Unit) {
    var companyMenu by remember { mutableStateOf(false) }
    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 12.dp, 20.dp, 80.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Icon(Icons.Default.CloudDownload, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(44.dp)); Text("חיבור מאובטח למקור הנתונים", fontSize = 25.sp, fontWeight = FontWeight.Bold); Text("פרטי הכניסה נשלחים ישירות לפעולת הייבוא ואינם נשמרים באפליקציה.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { Box { OutlinedButton({ companyMenu = true }, Modifier.fillMaxWidth()) { Text(company?.label ?: "בחירת בנק או חברת אשראי") }; DropdownMenu(companyMenu, { companyMenu = false }) { state.importCompanies.forEach { DropdownMenuItem({ Text("${it.label} · ${it.group}") }, { select(it.value); companyMenu = false }) } } } }
        if (selected == "visaCal") {
            item { SecureField(calId, setCalId, "תעודת זהות", false); SecureField(calLast4, setCalLast4, "4 ספרות אחרונות", false) }
        } else company?.fields?.forEach { field -> item { SecureField(fields[field.name].orEmpty(), { fields[field.name] = it }, field.label, field.type == "password") } }
        item { OutlinedTextField(startDate, setDate, label = { Text("ייבוא מתאריך") }, modifier = Modifier.fillMaxWidth(), singleLine = true); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("ייבוא הכנסות בלבד"); Switch(incomesOnly, setIncomes) }; state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; Button(submit, enabled = company != null && if (selected == "visaCal") calId.isNotBlank() && calLast4.isNotBlank() else company.fields.all { fields[it.name]?.isNotBlank() == true }, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(18.dp)) { Icon(Icons.Default.Security, null); Spacer(Modifier.width(8.dp)); Text(if (selected == "visaCal" || company?.otpFlow == true) "שליחת קוד אימות" else "התחלת ייבוא") } }
    }
}

@Composable private fun SecureField(value: String, change: (String) -> Unit, label: String, password: Boolean) = OutlinedTextField(value, change, label = { Text(label) }, visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(18.dp))
@Composable private fun OtpScreen(modifier: Modifier, title: String, otp: String, change: (String) -> Unit, error: String?, verify: () -> Unit, reset: () -> Unit) { Column(modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) { Text(title, fontSize = 25.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(16.dp)); SecureField(otp, change, "קוד חד־פעמי", false); error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; Button(verify, enabled = otp.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("אימות וייבוא") }; TextButton(reset, Modifier.fillMaxWidth()) { Text("חזרה") } } }
@Composable private fun ImportLoading(modifier: Modifier, message: String) { Column(modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) { CircularProgressIndicator(); Spacer(Modifier.height(18.dp)); Text(message, fontWeight = FontWeight.SemiBold) } }

@Composable private fun MappingScreen(modifier: Modifier, state: FinaState, mappings: MutableMap<String, Pair<String, String?>>, commit: () -> Unit) { LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp, 12.dp, 18.dp, 90.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { item { Text("מיפוי בתי עסק", fontSize = 26.sp, fontWeight = FontWeight.Bold); Text("נמצאו ${state.importPreview?.transactions?.size ?: 0} תנועות. יש להשלים קטגוריה לכל בית עסק חדש.") }; items(state.importPreview?.unseenMerchants.orEmpty()) { merchant -> var open by remember { mutableStateOf(false) }; Card(shape = RoundedCornerShape(20.dp)) { Column(Modifier.padding(14.dp)) { OutlinedTextField(mappings[merchant]?.first ?: merchant, { mappings[merchant] = it to mappings[merchant]?.second }, label = { Text("שם להצגה") }, modifier = Modifier.fillMaxWidth()); Box { OutlinedButton({ open = true }, Modifier.fillMaxWidth()) { Text(state.categories.find { it.id == mappings[merchant]?.second }?.name ?: "בחירת קטגוריה") }; DropdownMenu(open, { open = false }) { state.categories.forEach { category -> DropdownMenuItem({ Text(category.name) }, { mappings[merchant] = (mappings[merchant]?.first ?: merchant) to category.id; open = false }) } } } } } }; item { state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; Button(commit, enabled = mappings.values.all { it.second != null }, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("אישור ושמירת העסקאות") } } } }

@Composable private fun PreviewScreen(modifier: Modifier, state: FinaState, commit: () -> Unit, reset: () -> Unit) { LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(18.dp, 12.dp, 18.dp, 90.dp)) { item { Text("תצוגה מקדימה", fontSize = 26.sp, fontWeight = FontWeight.Bold); Text("${state.importPreview?.transactions?.size ?: 0} תנועות מוכנות לייבוא") }; items(state.importPreview?.transactions.orEmpty().take(100)) { tx -> ListItem(headlineContent = { Text(tx["description"]?.jsonPrimitive?.content ?: "תנועה") }, supportingContent = { Text(tx["category"]?.jsonPrimitive?.content.orEmpty()) }, trailingContent = { Text("₪${tx["amount"]?.jsonPrimitive?.content ?: "0"}") }) }; item { Button(commit, Modifier.fillMaxWidth()) { Text("שמירת כל העסקאות") }; TextButton(reset, Modifier.fillMaxWidth()) { Text("ביטול") } } } }
@Composable private fun ResultScreen(modifier: Modifier, message: String, reset: () -> Unit) { Column(modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) { Text("הייבוא הסתיים", fontSize = 28.sp, fontWeight = FontWeight.Bold); Text(message); Button(reset) { Text("ייבוא נוסף") } } }
