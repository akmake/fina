> Last updated: 2026-07-02
> Status: DRAFT — מסמך אפיון מחדש. מקור אמת למוצר v2. אינו מחליף את המסמכים הקנוניים הקיימים — הוא מגדיר את היעד שאליו הם יתעדכנו.

# Fina v2 — אפיון מוצר מחדש (SaaS)

---

## 1. סיווג המוצר

**Personal Finance Management SaaS** — פלטפורמת ניהול פיננסי למשקי בית בישראל, מרובת משתמשים.

הבידול המרכזי מול מתחרים (RiseUp, FamilyBiz וכו'):
1. **תמונת עושר מלאה** — לא רק תזרים: השקעות, פנסיה, נדל"ן, הלוואות, משכנתא, ביטוחים, מט"ח — הכל במקום אחד.
2. **חיבור אוטומטי לבנקים וכרטיסי אשראי ישראליים** (israeli-bank-scrapers).
3. **פיצ'רים ייחודיים לקהל הישראלי/דתי** — מעשר, חסכונות לילדים, מסלולי משכנתא.
4. **עברית ו-RTL כברירת מחדל**, לא כתרגום.

מה שהמוצר **אינו**: כלי הנהלת חשבונות לעסקים, פלטפורמת מסחר, או כלי CAD (המודולים "חשמל" ו"פרגולה" הקיימים בקוד — מחוץ ל-scope של המוצר, ראו סעיף 4.4).

---

## 2. הנחות ופערים פתוחים

### הנחות עבודה (נקבעו עם בעל המוצר)
| # | הנחה |
|---|------|
| A1 | המוצר מיועד למשתמשים רבים (SaaS), לא רק לשימוש אישי |
| A2 | דגש על עושר פיצ'רים — לא מוצר מינימלי |
| A3 | הקוד הקיים הוא הבסיס — בונים עליו, לא מתחילים מאפס |
| A4 | שפת המוצר: עברית בלבד בשלב ראשון (i18n — עתידי) |
| A5 | היחידה העסקית היא **משק בית (Household)**, לא משתמש בודד — מודל `FamilyGroup` הקיים הוא הבסיס |

### פערים פתוחים (דורשים החלטת בעל מוצר, לא חוסמים את שלבים 0–1)
| # | שאלה | ברירת מחדל מוצעת |
|---|------|------------------|
| Q1 | מודל תמחור — freemium? מנוי חודשי? | Freemium: חינם עד 2 חשבונות מחוברים, Premium למשק בית מלא |
| Q2 | האם "המלצות AI" (`Suggestion`) יחוברו ל-LLM אמיתי? | כן, בשלב 5 (Claude API) — עד אז חוקים דטרמיניסטיים |
| Q3 | שמירת פרטי התחברות לבנק לסנכרון אוטומטי — כן/לא? | כן, מוצפן (ראו 10.3) — זה פיצ'ר הליבה של SaaS פיננסי |
| Q4 | אפליקציית מובייל נייטיב? | לא — PWA קיים מספיק לשלבים 0–4 |
| Q5 | גורם "יועץ פיננסי" כ-role? | נדחה לשלב 5 |

---

## 3. תפקידים (Roles)

לא "user/admin" בלבד — תפקידים עסקיים אמיתיים:

| Role | מי זה | מטרות | מה מותר | מה אסור |
|------|-------|-------|---------|---------|
| **בעל משק בית** (owner) | מי שפתח את החשבון | שליטה מלאה בכספי המשפחה | הכל בתוך משק הבית: חיבור בנקים, הזמנת בני משפחה, מחיקה, ייצוא, ביטול מנוי | גישה למשקי בית אחרים |
| **שותף** (partner) | בן/בת זוג | ניהול שוטף משותף | הכל חוץ מ: מחיקת משק הבית, ניהול מנוי, הסרת ה-owner | פעולות חשבון קריטיות |
| **צופה** (viewer) | ילד בוגר / הורה מבוגר / רו"ח | מעקב בלבד | צפייה בדשבורדים ודוחות שהוגדרו לו | כל פעולת כתיבה, צפייה בפרטי התחברות |
| **מנהל מערכת** (admin) | צוות Fina | תפעול הפלטפורמה | ניהול משתמשים, לוגים, קונפיגורציה, תמיכה | צפייה בתנועות/נכסים של לקוחות ללא הסכמה מפורשת (impersonation מבוקר עם audit) |
| **אורח** (guest) | גולש לא רשום | להבין את המוצר ולהירשם | עמודי שיווק, הרשמה, דמו | הכל מעבר לזה |

**שינוי מהותי מהמצב הקיים**: היום `role` יושב על `User` ברמת מערכת (user/admin). ב-v2 יש שתי שכבות:
- `User.systemRole`: `user` | `admin` (רמת פלטפורמה)
- `HouseholdMember.role`: `owner` | `partner` | `viewer` (רמת משק בית)

---

## 4. מפת מודולים

### 4.1 מודולי ליבה (קיימים — משמרים ומחזקים)

| מודול | קבצים קיימים | מצב | פעולה ב-v2 |
|-------|--------------|-----|-------------|
| אימות והרשאות | `authController`, middlewares | עובד | הוספת שכבת Household, אימות דו-שלבי (שלב 4) |
| תנועות (Transactions) | `transactionController`, `Transaction` | עובד | ליבת המוצר — שיפור קטגוריזציה, split, חיפוש |
| ייבוא בנקים | `scraperController`, `calController`, `importController` | עובד חלקית, **לא מאובטח ל-SaaS** | בנייה מחדש כ-Import Jobs מאובטחים (ראו 5.2) |
| קטגוריות וכללים | `Category`, `CategoryRule`, `MerchantMap` | עובד | מנוע למידה מהתנהגות המשתמש |
| תקציב | `budgetController`, `Budget` | עובד חלקית | מחזור תקציב חודשי מלא + התראות |
| שווי נקי | `netWorthController`, `NetWorthSnapshot` | עובד | Snapshot אוטומטי יומי במקום ידני |
| הלוואות ומשכנתא | `loanController`, `mortgageController` | עובד | מסלולי משכנתא מרובים (פער ידוע ב-known-unknowns) |
| השקעות | `Stock`, `Fund`, `Deposit`, `Pension`, `ForeignCurrency` | מפוצל מדי | איחוד ל"תיק נכסים" אחד עם UI אחיד |
| יעדים וחסכונות | `Goal`, `ChildSavings`, `Project` | עובד חלקית | חיבור יעדים לתנועות אמיתיות (מעקב אוטומטי) |
| מעשר | `maaserController` | עובד | פיצ'ר בידול — לשמר ולהשקיע |
| ביטוחים ונדל"ן | `Insurance`, `RealEstate` | בסיסי | תזכורות חידוש, הצמדת שווי |
| התראות | `Alert` | חלקי | מנוע התראות מרכזי + ערוצי שליחה (ראו 4.3) |
| אדמין | `adminUsers`, `logsController` | בסיסי | back-office מלא לשלב 4 |

### 4.2 מודולים חדשים (חסרים היום — נדרשים ל-SaaS)

| מודול | תפקיד | שלב |
|-------|-------|-----|
| **Household (tenant)** | משק בית כיחידת בעלות על כל הנתונים; הזמנות; roles פנימיים | 1 |
| **Import Jobs** | סנכרון בנקים כ-job אסינכרוני עם סטטוסים, היסטוריה, ותזמון אוטומטי | 2 |
| **Bank Connections** | שמירה מוצפנת של חיבורי בנק + הסכמה מפורשת + ניתוק | 2 |
| **Notifications** | ערוץ אחיד: in-app, email, (עתידי: push/WhatsApp) | 3 |
| **Onboarding** | אשף פתיחה: משק בית → חיבור בנק ראשון → תקציב ראשון | 4 |
| **Billing/Subscription** | תוכניות, תשלום, מגבלות שימוש | 4 |
| **Audit Log** | תיעוד פעולות רגישות (מחיקות, שינויי הרשאה, גישת אדמין) | 0–1 |
| **Data Lifecycle** | ייצוא כל הנתונים, מחיקת חשבון מלאה (חובה חוקית ל-SaaS) | 4 |

### 4.3 מנוע התראות — פירוט (דגש פיצ'רים)

טריגרים: חריגת תקציב (75%/90%/100%), חיוב חריג (סכום/סוחר חדש), הוראת קבע שהשתנתה, כפל חיוב, יתרה נמוכה, ריבית משתנה בהלוואה, חידוש ביטוח מתקרב, יעד חיסכון בסיכון, פיקדון שמסתיים, סנכרון בנק שנכשל.

### 4.4 מודולים שיוצאים מהמוצר

- **Electrical CAD** (`electricalController`, Fabric.js canvas) ו-**Pergola planner** — כלים אישיים שאינם קשורים לפיננסים. ב-v2: מוקפאים (לא נמחקים מהקוד בשלב 0, מוסתרים מהניווט), ומועמדים לפיצול לריפו נפרד.
- מודלים יתומים לבדיקה: `centerModel`, `DataRecordModel`, `adminCenters`, `adminOrders`, `cartRoutes` — שרידי מערכת קודמת (DB בשם `corse`). לבדוק ולמחוק בשלב 0.

---

## 5. תהליכי ליבה (Workflows)

### 5.1 המסלול הקריטי של המוצר (The Core Loop)

```
חיבור בנק → סנכרון אוטומטי → קטגוריזציה חכמה → תקציב חי → תובנה/התראה → פעולה של המשתמש
```

כל פיצ'ר נמדד לפי תרומתו ללולאה הזו.

### 5.2 סנכרון בנק (בנייה מחדש — הפער המרכזי)

**מצב היום**: המשתמש מזין פרטי בנק בכל פעם, ה-route ציבורי ללא auth, הסריקה סינכרונית (המשתמש מחכה), אין היסטוריה, אין התאוששות מכשל.

**v2 — Import Job אסינכרוני:**

| שלב | פירוט |
|-----|-------|
| טריגר | ידני (כפתור "סנכרן עכשיו") או מתוזמן (cron יומי לחיבורים שמורים) |
| התחלה | יצירת `ImportJob` בסטטוס `queued`; תשובה מיידית ללקוח עם jobId |
| ריצה | worker מריץ scraper; סטטוס `running`; polling/socket לעדכון UI |
| 2FA | אם הבנק דורש OTP → סטטוס `awaiting_otp` → המשתמש מזין → ממשיכים |
| עיבוד | dedup לפי `identifier` → MerchantMap → CategoryRule → שמירה |
| סיום | `completed` עם סיכום (X חדשות, Y כפולות, Z ללא קטגוריה) או `failed` עם סיבה מתורגמת לעברית |
| כשל | retry אוטומטי פעם אחת; אחרי כשל שני — התראה למשתמש |

**סטטוסים**: `queued → running → awaiting_otp → running → completed | failed | cancelled`

### 5.3 קטגוריזציה (החלטות המשתמש מלמדות את המערכת)

1. תנועה חדשה → MerchantMap → CategoryRule → קטגוריה או "ממתין לסיווג".
2. משתמש מסווג ידנית → המערכת מציעה: "לסווג כך את כל התנועות הדומות? ליצור כלל?"
3. אישור → נוצר `CategoryRule` ברמת משק הבית → תנועות עבר מתעדכנות (באישור).
4. תנועה מפוצלת (super + בית מרקחת בקנייה אחת) → split לתת-תנועות.

### 5.4 מחזור תקציב חודשי

1. תחילת חודש: התקציב "מתגלגל" אוטומטית (עם rollover אופציונלי של יתרות).
2. במהלך החודש: כל תנועה מסווגת מתעדכנת בתקציב בזמן אמת.
3. חציית ספים (75/90/100%) → התראה.
4. סוף חודש: סיכום חודשי אוטומטי (email + in-app) + הצעת התאמות לחודש הבא.

### 5.5 הזמנת בן משפחה

1. Owner מזין email + role → נוצרת הזמנה עם token (תוקף 7 ימים).
2. המוזמן נרשם/מתחבר → מאשר הצטרפות → נוצר `HouseholdMember`.
3. Edge: המוזמן כבר בעל משק בית משלו → בחירה: להצטרף כחבר נוסף (משתמש יכול להשתייך ליותר ממשק בית אחד, עם משק בית "פעיל" אחד ב-UI).

### 5.6 יעד חיסכון מחובר לנתונים

יעד ≠ מספר סטטי. יעד מקושר לחשבון/קטגוריה: "חיסכון לרכב — 3,000 ₪ בחודש לחשבון X" → המערכת עוקבת אוטומטית אם ההפקדה קרתה, מציגה תחזית ("בקצב הזה תגיע ליעד באפריל 2027"), ומתריעה על פיגור.

---

## 6. תוכנית UX

### 6.1 עקרון מארגן: מ-54 עמודים ל-~20

היום יש 54 עמודים שטוחים — מבנה של "עמוד לכל טבלת DB". ב-v2 הניווט נבנה לפי משימות המשתמש:

| אזור ניווט | מה נכנס אליו | עמודים קיימים שמתאחדים |
|------------|---------------|--------------------------|
| **בית** | דשבורד אחד: שווי נקי, תזרים החודש, תקציב, התראות, פעולות ממתינות | `FinanceDashboard`, `DashboardPage`, `HomePage`, `SmartAnalyticsDashboard` → **אחד** |
| **תנועות** | רשימה + חיפוש + סיווג + ממתינות לסיווג | `Transactions_tab`, `DataEntryPage`, `RecurringPage`, `MerchantsPage` |
| **תקציב** | תקציב חודשי חי + היסטוריה | `BudgetPage`, `CategoryInsightsPage` |
| **תיק נכסים** | טאבים: מניות, קרנות, פיקדונות, פנסיה, מט"ח, נדל"ן | `InvestmentsPage`, `FundsPage`, `DepositsPage`, `PensionPage`, `ForeignCurrencyPage`, `FinancePortfolioPage`, `RealEstatePage` → **אחד עם טאבים** |
| **התחייבויות** | הלוואות, משכנתא, חובות | `MyLoansPage`, `LoanDetailPage`, `NewLoanPage`, `MortgagePage`, `DebtPage` |
| **יעדים** | יעדים, חסכונות ילדים, מעשר | `GoalsPage`, `ChildSavingsPage`, `MaaserPage`, `ProjectsPage` |
| **חיבורים** | אשף ייבוא אחד (בנק/אקסל) + היסטוריית סנכרונים | `ImportPage`, `AutoImportPage`, `ExcelImportPage`, `CalDirectImportPage`, `DiscountImportPage`, `MaxImportPage` → **אשף אחד** |
| **דוחות** | דוחות + תובנות + המלצות | `ReportsPage`, `SuggestionsPage`, `AlertsPage`, `TaxPage` |
| **הגדרות** | פרופיל, משק בית וחברים, מנוי, קטגוריות, פרטיות | `SettingsPage`, `ProfilePage`, `FamilyPage`, `InsurancePage` |
| **אדמין** (admins) | משתמשים, לוגים, קונפיג | `AdminUsersPage`, `AdminLogsPage`, `UserActivityPage`, `ManagementPage` |

### 6.2 לכל מסך — חובה להגדיר

לפי הסקיל: מי המשתמש, מה המטרה, מה הפעולה הראשית, מה גלוי מיד, מה מוסתר, אילו פעולות מסוכנות (אישור כפול), empty state, error state, loading state (skeleton).

**דוגמה — דשבורד הבית**: פעולה ראשית = "סווג X תנועות ממתינות" (אם יש) או "סנכרן עכשיו". גלוי מיד: שווי נקי + מגמה, תזרים החודש מול תקציב, 3 התראות אחרונות. Empty state (משתמש חדש): לא גרפים ריקים — כרטיס onboarding "חבר את הבנק הראשון שלך".

### 6.3 כללי UX רוחביים

- **RTL מלא**, מספרים ומטבע בפורמט ישראלי (₪, פסיק לאלפים) — `formatters.js` הוא המקור היחיד.
- מובייל תחילה לדשבורד ולסיווג תנועות (המשימות היומיומיות); דוחות — דסקטופ בעיקר.
- כל פעולה הרסנית (מחיקת חשבון, ניתוק בנק, מחיקת קטגוריה בשימוש) — דיאלוג אישור עם השלכות מפורשות.
- סיווג תנועות = משימה בתדירות גבוהה → אינטראקציית מקלדת/החלקה מהירה, לא טופס מלא לכל תנועה.

---

## 7. מודל נתונים — שינויים נדרשים

### 7.1 ישויות חדשות

| ישות | שדות עיקריים | הערות |
|------|---------------|-------|
| `Household` | `name`, `owner→User`, `plan`, `createdAt` | הרחבה/החלפה של `FamilyGroup` הקיים |
| `HouseholdMember` | `household`, `user`, `role` (owner/partner/viewer), `status` (invited/active/removed), `invitedBy`, `joinedAt` | |
| `BankConnection` | `household`, `bank`, `credentialsEncrypted`, `nickname`, `status` (active/error/disabled), `lastSyncAt`, `consentAt` | הצפנה: ראו 10.3 |
| `ImportJob` | `household`, `connection`, `status`, `trigger` (manual/scheduled), `summary` {new, dup, uncategorized}, `error`, timestamps | |
| `Notification` | `user`, `household`, `type`, `title`, `body`, `channel` (inapp/email), `readAt`, `sentAt` | |
| `Subscription` | `household`, `plan`, `status` (trial/active/past_due/cancelled), `provider`, `periodEnd` | שלב 4 |
| `AuditLog` | `actor`, `household`, `action`, `entity`, `entityId`, `before/after`, `ip`, `at` | append-only |

### 7.2 שינויים בישויות קיימות

| שינוי | היקף |
|-------|------|
| **כל מודל user-scoped מקבל `household`** (בנוסף ל-`user` שנשמר כ"מי יצר") | Transaction, Budget, Category, Account, Loan, Goal... — מיגרציה: לכל user קיים נוצר Household אישי |
| **Soft delete** (`deletedAt`) לישויות עסקיות: Transaction, Account, Loan, Goal, Budget | היום הכל hard-delete — מסוכן ל-SaaS |
| `Transaction` — הוספת `status` (pending/cleared), `splitParent`, `importJob` | |
| `Mortgage` — מסלולים מרובים: `tracks[]` {type: קבועה/פריים/צמודה, principal, rate, termMonths} | סוגר פער ידוע |
| `User` — `systemRole`, `emailVerifiedAt`, `lastLoginAt`, `preferences` | |
| `CategoryRule`, `MerchantMap`, `Category` — עוברים לרמת household (לא user) | כללי סיווג משותפים למשפחה |

### 7.3 ולידציות מרכזיות

- `Transaction.amount` ≠ 0; `date` לא עתידי מעל שנה; `category` חייבת להשתייך לאותו household.
- `Budget`: קטגוריה אחת = שורת תקציב אחת לתקופה (unique compound `[household, category, period, startDate]`).
- `HouseholdMember`: user אחד לא יכול להופיע פעמיים באותו household; חייב להישאר לפחות owner אחד.
- כל query בכל controller מסונן `{ household: req.household._id }` — נאכף ב-middleware `familyScope` המורחב, לא בכל controller בנפרד.

---

## 8. הרשאות — מטריצה

| פעולה | owner | partner | viewer | admin (מערכת) |
|-------|:-----:|:-------:|:------:|:--------------:|
| צפייה בדשבורד/דוחות | ✔ | ✔ | ✔ | ✖ (רק ב-impersonation מתועד) |
| הוספה/עריכת תנועות, תקציב, יעדים | ✔ | ✔ | ✖ | ✖ |
| חיבור/ניתוק בנק | ✔ | ✔ | ✖ | ✖ |
| צפייה בפרטי BankConnection | ✔ | ✖ | ✖ | ✖ |
| הזמנה/הסרה של חברים | ✔ | ✖ | ✖ | ✖ |
| מחיקת נתונים (soft) | ✔ | ✔ | ✖ | ✖ |
| ייצוא נתונים / מחיקת חשבון | ✔ | ✖ | ✖ | ✖ |
| ניהול מנוי ותשלום | ✔ | ✖ | ✖ | ✖ |
| ניהול משתמשי פלטפורמה, לוגים | ✖ | ✖ | ✖ | ✔ |

פעולות עם **audit חובה**: מחיקות, שינויי role, חיבור/ניתוק בנק, ייצוא, כל גישת admin לנתוני לקוח.

---

## 9. חוקים עסקיים ומקרי קצה

### חוקים עסקיים
1. תנועה מיובאת עם `identifier` קיים באותו household — לא נשמרת פעמיים (dedup).
2. אי אפשר למחוק קטגוריה שיש עליה תנועות — רק מיזוג לקטגוריה אחרת.
3. אי אפשר למחוק Account עם תנועות — רק archive.
4. חריגת תקציב לא חוסמת שום פעולה — רק מתריעה (המערכת משקפת מציאות, לא אוכפת).
5. שווי נקי = Σ(נכסים) − Σ(התחייבויות); snapshot יומי אוטומטי, לא ניתן לעריכה ידנית.
6. הורדת role או הסרת חבר — לא מוחקת נתונים שהוא יצר (הבעלות היא של משק הבית).
7. ביטול מנוי → downgrade ל-free בסוף התקופה; הנתונים לא נמחקים, פיצ'רים ננעלים לקריאה.

### מקרי קצה קריטיים
| מקרה | טיפול |
|------|--------|
| שני חברים מסווגים אותה תנועה במקביל | last-write-wins + עדכון real-time; ה-audit שומר את שניהם |
| סנכרון בנק מחזיר תנועה שהשתנתה (סכום עודכן ע"י הבנק) | עדכון לפי `identifier` + סימון "עודכן ע"י הבנק" |
| הבנק דורש OTP באמצע סנכרון מתוזמן (אין משתמש מחובר) | job עובר ל-`awaiting_otp` → נשלחת התראה → פג אחרי 15 דק' → `failed` עם הסבר |
| scraper נשבר אחרי עדכון של בנק | job נכשל בחן; התראה למשתמש "הבנק עדכן את האתר, אנחנו מטפלים"; התראה לאדמין; שאר הבנקים לא מושפעים |
| משתמש מוזמן לא נרשם תוך 7 ימים | ההזמנה פגה; owner רואה סטטוס "פג תוקף" ויכול לשלוח שוב |
| owner מוחק את חשבונו כשיש חברים נוספים | חסום — חייב להעביר בעלות או למחוק את משק הבית כולו (עם אישור כפול) |
| ייבוא אקסל עם עמודות לא תקינות | ולידציה לפני שמירה; דוח שגיאות שורה-שורה; שום דבר לא נשמר חלקית |
| תנועה במט"ח | נשמרת במטבע המקור + שער ההמרה ביום התנועה; מוצגת בשקלים |

---

## 10. ארכיטקטורה

### 10.1 נשאר כמו היום
Monorepo (client React+Vite / server Express), MongoDB Atlas, Zustand + React Query, JWT ב-httpOnly cookies, Tailwind. אין שכתוב סטאק.

### 10.2 שינויים נדרשים

| נושא | היום | v2 |
|------|------|-----|
| **Routes ציבוריים** | `/api/scrape`, `/api/cal`, `/api/import` פתוחים לכולם | **כולם מאחורי requireAuth + CSRF + rate limit ייעודי.** ב-SaaS אסור endpoint פתוח שמריץ Puppeteer — זה וקטור DoS וגניבת credentials |
| סריקה | סינכרונית בתוך request | Job queue (BullMQ + Redis, או agenda על Mongo אם רוצים בלי תשתית נוספת — **החלטה: agenda בשלב 2, BullMQ אם יש עומס**) |
| Secrets | `JWT_ACCESS_SECRET` עם ברירת מחדל placeholder | הסרה של כל ברירות המחדל — השרת לא עולה בלעדיהן ב-production |
| קונפיג כפול | `config/routes.js` + `config/middlewares.js` לצד `app.js` | מחיקת ה-legacy, `app.js` קנוני יחיד |
| שגיאות | פורמט לא אחיד | envelope אחיד: `{ ok, data }` / `{ ok:false, error: { code, message } }` — לפי `docs/contracts.md` |
| בדיקות | אין | Vitest + Supertest; חובה על: auth, familyScope, dedup, budget math, הרשאות |

### 10.3 אבטחת BankConnection (החלטה קריטית ל-Q3)
- הצפנת credentials ב-AES-256-GCM עם מפתח מ-env (`BANK_CRED_KEY`), לעולם לא בלוגים.
- Consent מפורש בזמן שמירה + אפשרות ניתוק שמוחקת מיידית.
- ה-credentials מפוענחים רק בתוך ה-worker, לעולם לא נשלחים ל-client בשום צורה.
- חלופה למשתמש חשדן: מצב "בלי שמירה" — הזנה ידנית בכל סנכרון (הזרימה הקיימת, אבל מאחורי auth).

### 10.4 ניקיון (שלב 0)
מחיקה/הכרעה לגבי: `centerModel`, `adminCenters/adminOrders/cartRoutes`, `server/stores/authStore.js`, `DataRecordModel`, `bcryptjs`, סקריפטי python בשורש, `vc.html` — רובם שרידים שמסומנים כבר ב-[known-unknowns.md](known-unknowns.md).

---

## 11. סדר בנייה

> עקרון: קודם מייצבים ומאבטחים את מה שקיים (המשתמשים של היום לא נשברים), ואז מוסיפים שכבת tenant, ורק אחר כך פיצ'רים חדשים.

| שלב | שם | תכולה | קריטריון סיום |
|-----|-----|--------|----------------|
| **0** | ייצוב ואבטחה | auth על routes ציבוריים, הסרת secrets ברירת-מחדל, envelope אחיד, מחיקת legacy, soft delete, AuditLog בסיסי, בדיקות ל-auth+isolation | אין endpoint לא מאובטח; CI ירוק |
| **1** | Household | מודל Household+Members, מיגרציית נתונים, familyScope מורחב, הזמנות, מטריצת הרשאות | שני משתמשים חולקים משק בית ורואים אותם נתונים; viewer לא יכול לכתוב |
| **2** | Import 2.0 | BankConnection מוצפן, ImportJob אסינכרוני, תזמון יומי, אשף ייבוא אחד ב-UI, טיפול ב-OTP | סנכרון אוטומטי יומי עובד ללא נוכחות משתמש |
| **3** | Core Loop | איחוד דשבורד, סיווג מהיר + למידת כללים, מחזור תקציב מלא, מנוע התראות + Notifications, יעדים מחוברים, איחוד תיק נכסים | הלולאה 5.1 שלמה מקצה לקצה |
| **4** | SaaS Shell | onboarding, אימות email, billing/plans, ייצוא ומחיקת חשבון, back-office אדמין, 2FA | משתמש זר יכול להירשם, לשלם ולהשתמש בלי ליווי |
| **5** | Advanced | תובנות AI אמיתיות (Claude API), תחזית תזרים, benchmarks, מסלולי משכנתא מתקדמים, role יועץ | — |

---

## 12. תוכנית קוד — שלב 0 (המשימות הראשונות לביצוע)

1. `server/app.js` — העברת `/api/scrape`, `/api/cal`, `/api/import` אל מאחורי requireAuth + CSRF; rate limiter ייעודי (למשל 5 בקשות/שעה/משתמש לסריקה).
2. עדכון עמודי הייבוא ב-client לעבוד עם ה-auth הקיים (הם כבר בתוך ProtectedRoute — השינוי בעיקר בשרת).
3. `authController` / `authMiddleware` — זריקת שגיאה אם `JWT_*_SECRET` חסר ב-production.
4. מחיקת legacy: `config/routes.js`, `config/middlewares.js` (אחרי אימות ש-`app.js` קנוני), `bcryptjs`, מודלים יתומים.
5. הוספת `deletedAt` + query helpers ל-Transaction/Account/Loan/Goal/Budget.
6. מודל `AuditLog` + helper `audit(actor, action, entity, before, after)` בפעולות מחיקה ושינוי הרשאה.
7. הקמת Vitest + Supertest; בדיקות ראשונות: login, refresh, בידוד נתונים בין users, CSRF.
8. עדכון כל המסמכים הקנוניים שהושפעו (לפי [sync-map.md](sync-map.md)).

**כל שלב עתידי ייפתח באפיון מפורט משלו לפני קוד**, לפי אותו סקיל.

---

## נספח: טבלת עמודים קיימים → יעד v2

| עמוד קיים | גורל |
|-----------|------|
| FinanceDashboard, DashboardPage, HomePage, SmartAnalyticsDashboard | מיזוג לדשבורד אחד |
| ImportPage, AutoImportPage, ExcelImportPage, CalDirectImportPage, DiscountImportPage, MaxImportPage | מיזוג לאשף חיבורים אחד |
| InvestmentsPage, FundsPage, DepositsPage, PensionPage, ForeignCurrencyPage, FinancePortfolioPage | מיזוג לתיק נכסים עם טאבים |
| MyLoansPage, LoanDetailPage, NewLoanPage, MortgagePage, DebtPage | נשארים תחת "התחייבויות" |
| GoalsPage, ChildSavingsPage, MaaserPage, ProjectsPage | נשארים תחת "יעדים" |
| BudgetPage, CategoryInsightsPage | נשארים תחת "תקציב" |
| Transactions_tab, DataEntryPage, RecurringPage, MerchantsPage | נשארים תחת "תנועות" |
| ReportsPage, SuggestionsPage, AlertsPage, TaxPage | נשארים תחת "דוחות" |
| SettingsPage, ProfilePage, FamilyPage, InsurancePage | נשארים תחת "הגדרות" |
| BusinessPage, NewProjectPage, ProjectPage | לבחינה — ככל הנראה מיזוג ל"יעדים" |
| Electrical / Pergola (components) | הקפאה, מועמדים לפיצול מהריפו |
| AdminUsersPage, AdminLogsPage, UserActivityPage, ManagementPage | back-office (שלב 4) |
