package com.fina.android.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fina.android.data.model.*
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

private val HE_MONTHS = listOf("ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ")
private val INCOME = Color(0xFF10B981)
private val EXPENSE = Color(0xFFEF4444)
private val BLUE = Color(0xFF3B82F6)

private fun money(value: Double): String = NumberFormat.getCurrencyInstance(Locale("he", "IL")).apply { maximumFractionDigits = 0 }.format(value)
private fun hexColor(s: String): Color = try { Color(android.graphics.Color.parseColor(s)) } catch (e: Exception) { Color(0xFF64748B) }
private fun priorityColor(p: String): Color = when (p) { "high" -> EXPENSE; "medium" -> Color(0xFFF59E0B); else -> BLUE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(vm: FinaViewModel, state: FinaState) {
    val name = state.user?.name.orEmpty()
    val d = state.dashboard
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("שלום ${name.ifBlank { "לך" }} 👋", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(vm::loadDashboard) { Icon(Icons.Default.Refresh, "רענון") }
                    IconButton(vm::logout) { Icon(Icons.AutoMirrored.Filled.Logout, "התנתקות") }
                }
            )
        }
    ) { padding ->
        if (d == null && state.loading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 110.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
            if (d == null) return@LazyColumn

            val nw = d.netWorth
            val month = d.summary?.monthlySummary?.thisMonth ?: MonthTotals()
            val prev = d.summary?.monthlySummary?.prevMonth ?: MonthTotals()
            val netFlow = month.income - month.expense
            val savingsRate = if (month.income > 0) Math.round(netFlow / month.income * 100).toInt() else null
            val unread = d.alerts?.alerts?.filter { !it.read } ?: emptyList()

            // ── Action hero ──
            item { ActionHero(unread.size) }

            // ── KPI grid ──
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Kpi("שווי נקי כולל", money(nw?.netWorth ?: 0.0),
                        d.health?.let { "דירוג ${it.grade} · ${it.gradeLabel}" }, if ((nw?.netWorth ?: 0.0) >= 0) INCOME else EXPENSE, Modifier.weight(1f))
                    Kpi("חיסכון נטו החודש", money(netFlow),
                        savingsRate?.let { "שיעור חיסכון $it%" }, if (netFlow >= 0) INCOME else EXPENSE, Modifier.weight(1f))
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Kpi("הכנסות החודש", money(month.income), "קודם: ${money(prev.income)}", INCOME, Modifier.weight(1f))
                    Kpi("הוצאות החודש", money(month.expense), "קודם: ${money(prev.expense)}", EXPENSE, Modifier.weight(1f))
                }
            }

            // ── Monthly cashflow (this year) ──
            val curYear = java.time.LocalDate.now().year
            val monthly = d.yearly?.years?.get(curYear.toString())?.monthly ?: emptyMap()
            val monthRows = monthly.entries
                .mapNotNull { (k, v) -> k.toIntOrNull()?.let { Triple(it, v.income, v.expense) } }
                .filter { it.second > 0 || it.third > 0 }
                .sortedBy { it.first }
            if (monthRows.isNotEmpty()) {
                item {
                    SectionCard("תזרים חודשי — $curYear", Icons.AutoMirrored.Filled.TrendingUp) {
                        MonthlyBars(monthRows)
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            LegendDot("הכנסות", INCOME); LegendDot("הוצאות", EXPENSE)
                        }
                    }
                }
            }

            // ── Net worth history ──
            val hist = d.history?.history ?: emptyList()
            if (hist.size > 1) {
                item {
                    SectionCard("צמיחת שווי נקי", Icons.Default.ShowChart) {
                        LineChart(hist.map { it.netWorth })
                        Spacer(Modifier.height(8.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(hist.first().label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(hist.last().label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            // ── Asset allocation ──
            val assets = nw?.assetBreakdown?.filter { it.value > 0 } ?: emptyList()
            if (assets.isNotEmpty()) {
                item {
                    SectionCard("הרכב נכסים", Icons.Default.PieChart) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(150.dp), contentAlignment = Alignment.Center) {
                                Donut(assets, Modifier.fillMaxSize())
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("סך נכסים", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(money(nw?.assets?.total ?: 0.0), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                            }
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                assets.forEach { slice ->
                                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                        Box(Modifier.size(9.dp).background(hexColor(slice.color), CircleShape))
                                        Spacer(Modifier.width(8.dp))
                                        Text(slice.label, Modifier.weight(1f), fontSize = 13.sp)
                                        Text(money(slice.value), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ── Budget usage ──
            val budgetItems = d.budget?.budget?.items?.filter { it.limit > 0 }?.take(6) ?: emptyList()
            if (budgetItems.isNotEmpty()) {
                item {
                    SectionCard("ניצול תקציב", Icons.Default.AccountBalanceWallet) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            budgetItems.forEach { b ->
                                val pct = if (b.limit > 0) (b.spent / b.limit * 100).toInt() else 0
                                Column {
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text(b.category, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        Text("${money(b.spent)} / ${money(b.limit)}", fontSize = 12.sp,
                                            color = if (pct > 100) EXPENSE else MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Spacer(Modifier.height(5.dp))
                                    LinearProgressIndicator(
                                        progress = { (pct / 100f).coerceIn(0f, 1f) },
                                        modifier = Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(4.dp)),
                                        color = if (pct > 100) EXPENSE else if (pct > 80) Color(0xFFF59E0B) else INCOME,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ── Top categories vs previous month ──
            val catRows = buildCategoryRows(d.topCategories, d.prevCategories)
            if (catRows.isNotEmpty()) {
                item {
                    SectionCard("הוצאות מרכזיות החודש", Icons.Default.Category) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            catRows.forEach { r ->
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(r.category, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        Text("קודם: ${money(r.previous)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(money(r.current), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                        Text(
                                            if (r.delta == null) "חדש" else "${if (r.delta > 0) "+" else ""}${r.delta}%",
                                            fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                                            color = if ((r.delta ?: 0) > 0) EXPENSE else INCOME
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ── Financial summary modules ──
            val modules = buildModules(nw)
            if (modules.isNotEmpty()) {
                item {
                    SectionCard("תמונה פיננסית כוללת", Icons.Default.Dashboard) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            modules.chunked(2).forEach { row ->
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    row.forEach { m -> ModuleCell(m, Modifier.weight(1f)) }
                                    if (row.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }

            // ── Active alerts ──
            if (unread.isNotEmpty()) {
                item {
                    SectionCard("התראות פעילות", Icons.Default.NotificationsActive) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            unread.take(5).forEach { a ->
                                Text(a.body, fontSize = 13.sp, modifier = Modifier.fillMaxWidth()
                                    .background(EXPENSE.copy(alpha = .08f), RoundedCornerShape(10.dp)).padding(10.dp))
                            }
                        }
                    }
                }
            }

            // ── Health tips ──
            val tips = d.health?.tips ?: emptyList()
            if (tips.isNotEmpty()) {
                item {
                    SectionCard("מה כדאי לשפר", Icons.Default.HealthAndSafety) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            tips.take(4).forEach { t ->
                                Row(verticalAlignment = Alignment.Top) {
                                    Text(t.icon.ifBlank { "•" }, fontSize = 15.sp)
                                    Spacer(Modifier.width(8.dp))
                                    Text(t.tip, fontSize = 13.sp, modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }

            // ── Recommendations ──
            if (d.recommendations.isNotEmpty()) {
                item {
                    SectionCard("תובנות וייעול", Icons.Default.Lightbulb) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            d.recommendations.take(5).forEach { rec ->
                                Row(verticalAlignment = Alignment.Top) {
                                    Box(Modifier.padding(top = 5.dp).size(8.dp).background(priorityColor(rec.priority), CircleShape))
                                    Spacer(Modifier.width(10.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(rec.body, fontSize = 13.sp)
                                        (rec.potentialSavings ?: rec.savings)?.let {
                                            if (it > 0) Text("חיסכון פוטנציאלי: ${money(it)}", fontSize = 12.sp, color = INCOME, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ─── Building blocks ────────────────────────────────────────────────────────

@Composable private fun Kpi(label: String, value: String, sub: String?, color: Color, modifier: Modifier) {
    Card(modifier, shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(14.dp)) {
            Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(6.dp))
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = color)
            sub?.let { Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 3.dp)) }
        }
    }
}

@Composable private fun SectionCard(title: String, icon: ImageVector, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            Spacer(Modifier.height(14.dp))
            content()
        }
    }
}

@Composable private fun LegendDot(label: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).background(color, CircleShape)); Spacer(Modifier.width(6.dp))
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable private fun ActionHero(alerts: Int) {
    val bg = if (alerts > 0) Color(0xFFFEF3C7) else Color(0xFFDBEAFE)
    val fg = if (alerts > 0) Color(0xFFB45309) else Color(0xFF1D4ED8)
    Row(
        Modifier.fillMaxWidth().background(bg, RoundedCornerShape(18.dp)).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(if (alerts > 0) Icons.Default.Notifications else Icons.Default.CheckCircle, null, tint = fg)
        Spacer(Modifier.width(12.dp))
        Column {
            Text(if (alerts > 0) "יש $alerts התראות שדורשות טיפול" else "הכול מעודכן", fontWeight = FontWeight.Bold, color = fg)
            Text(if (alerts > 0) "עברו להתראות לפרטים" else "הנתונים שלך עדכניים", fontSize = 12.sp, color = fg.copy(alpha = .8f))
        }
    }
}

private data class ModuleInfo(val label: String, val value: Double, val count: Int, val color: Color)

@Composable private fun ModuleCell(m: ModuleInfo, modifier: Modifier) {
    Column(modifier.background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .4f), RoundedCornerShape(14.dp)).padding(12.dp)) {
        Text(m.label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(money(m.value), fontSize = 15.sp, fontWeight = FontWeight.Bold, color = m.color)
        if (m.count > 0) Text("${m.count} רשומות", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun buildModules(nw: NetWorthResponse?): List<ModuleInfo> {
    val a = nw?.assets ?: return emptyList()
    val l = nw.liabilities
    return listOf(
        ModuleInfo("פיקדונות", a.deposits, a.depositsCount, BLUE),
        ModuleInfo("מניות", a.stocks, a.stocksCount, INCOME),
        ModuleInfo("קרנות", a.funds, a.fundsCount, Color(0xFFEC4899)),
        ModuleInfo("פנסיה", a.pension, a.pensionCount, Color(0xFF06B6D4)),
        ModuleInfo("נדל\"ן", a.realEstate, a.realEstateCount, Color(0xFFF97316)),
        ModuleInfo("מט\"ח", a.foreignCurrency, a.foreignCurrencyCount, Color(0xFF14B8A6)),
        ModuleInfo("חיסכון ילדים", a.childSavings, a.childSavingsCount, Color(0xFFA855F7)),
        ModuleInfo("הלוואות", l.loans, l.loansCount, EXPENSE),
        ModuleInfo("משכנתאות", l.mortgages, l.mortgagesCount, Color(0xFFF97316)),
    ).filter { it.value != 0.0 }
}

private data class CatRow(val category: String, val current: Double, val previous: Double, val delta: Int?)

private fun buildCategoryRows(cur: List<TopCategory>, prev: List<TopCategory>): List<CatRow> {
    val map = LinkedHashMap<String, Pair<Double, Double>>()
    cur.forEach { map[it.category] = it.total to 0.0 }
    prev.forEach { p -> map[p.category] = (map[p.category]?.first ?: 0.0) to p.total }
    return map.entries.map { (cat, v) ->
        val (c, p) = v
        CatRow(cat, c, p, if (p > 0) Math.round((c - p) / p * 100).toInt() else null)
    }.sortedByDescending { it.current }.take(7)
}

// ─── Charts (Compose Canvas) ────────────────────────────────────────────────

@Composable private fun Donut(slices: List<BreakdownSlice>, modifier: Modifier) {
    val total = slices.sumOf { it.value }.toFloat().coerceAtLeast(0.0001f)
    Canvas(modifier) {
        val stroke = size.minDimension * 0.16f
        val inset = stroke / 2
        var start = -90f
        slices.forEach { s ->
            val sweep = (s.value.toFloat() / total) * 360f
            drawArc(
                color = hexColor(s.color),
                startAngle = start, sweepAngle = sweep - 1.5f, useCenter = false,
                topLeft = Offset(inset, inset),
                size = Size(size.width - stroke, size.height - stroke),
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )
            start += sweep
        }
    }
}

@Composable private fun MonthlyBars(rows: List<Triple<Int, Double, Double>>) {
    val maxVal = rows.maxOf { max(it.second, it.third) }.coerceAtLeast(1.0)
    Row(Modifier.fillMaxWidth().height(150.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        rows.forEach { (m, inc, exp) ->
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                Row(Modifier.height(120.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Box(Modifier.width(7.dp).fillMaxHeight((inc / maxVal).toFloat().coerceIn(0.02f, 1f)).background(INCOME, RoundedCornerShape(3.dp)))
                    Box(Modifier.width(7.dp).fillMaxHeight((exp / maxVal).toFloat().coerceIn(0.02f, 1f)).background(EXPENSE, RoundedCornerShape(3.dp)))
                }
                Spacer(Modifier.height(4.dp))
                Text(HE_MONTHS.getOrElse(m - 1) { "" }, fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable private fun LineChart(values: List<Double>) {
    if (values.size < 2) return
    val minV = values.minOrNull() ?: 0.0; val maxV = values.maxOrNull() ?: 0.0
    val range = (maxV - minV).let { if (it == 0.0) 1.0 else it }
    val line = BLUE
    Canvas(Modifier.fillMaxWidth().height(120.dp)) {
        val stepX = size.width / (values.size - 1)
        fun y(v: Double) = (size.height - 6f) - ((v - minV) / range * (size.height - 12f)).toFloat()
        val path = Path().apply {
            moveTo(0f, y(values.first()))
            values.forEachIndexed { i, v -> lineTo(i * stepX, y(v)) }
        }
        val fill = Path().apply {
            addPath(path); lineTo(size.width, size.height); lineTo(0f, size.height); close()
        }
        drawPath(fill, line.copy(alpha = 0.12f))
        drawPath(path, line, style = Stroke(width = 3f, cap = StrokeCap.Round))
    }
}
