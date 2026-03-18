import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Wallet, RefreshCw, Layers,
  TrendingUp, Landmark, BarChart3, GraduationCap, Globe,
  Home, Scale, CreditCard, HandCoins, Baby,
  Target, Shield, Calculator, ClipboardList,
  DownloadCloud, FileSpreadsheet, Upload, Banknote,
  Bell, Cpu, Lightbulb, Users, ChevronDown, ChevronUp,
  Zap, ArrowLeft, CheckCircle2, Info, HelpCircle,
} from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────
const QUICK_STEPS = [
  { num: '1', icon: '📥', title: 'ייבא את הנתונים שלך', desc: 'חבר את חשבון הבנק לייבוא אוטומטי, או ייבא קובץ אקסל מהבנק. הנתונים יסונכרנו אוטומטית.', link: '/import/auto', linkLabel: 'ייבוא אוטומטי' },
  { num: '2', icon: '🏷️', title: 'הגדר קטגוריות', desc: 'הערכת עסקאות לקטגוריות (מזון, דיור, בידור...) מאפשרת ניתוח מדויק של ההוצאות.', link: '/categories', linkLabel: 'לניהול קטגוריות' },
  { num: '3', icon: '💰', title: 'צור תקציב חודשי', desc: 'הגדר תקרה לכל קטגוריה. הדשבורד יראה לך בזמן אמת כמה נשאר.', link: '/budget', linkLabel: 'לתקציב' },
  { num: '4', icon: '👨‍👩‍👧', title: 'הזמן את בן/בת הזוג', desc: 'צור אזור משפחתי ושתף את כל הנתונים — שניכם רואים את אותו החשבון בזמן אמת.', link: '/family', linkLabel: 'לאזור המשפחתי' },
];

const SECTIONS = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    color: '#3b82f6',
    bg: '#eff6ff',
    label: 'לוח בקרה',
    link: '/finance-dashboard',
    summary: 'המרכז של האפליקציה — סיכום מצבך הפיננסי במקום אחד.',
    features: [
      { title: 'המצב שלך — בקצרה', desc: 'כרטיס כהה בראש הדף שמסביר בשפה פשוטה מה קורה עם הכסף שלך: כמה חסכת, מה השווי הנקי, מה ההוצאה הגדולה ביותר.' },
      { title: '4 כרטיסי KPI', desc: 'הכנסות, הוצאות, חיסכון נטו ושווי נקי — כולם עם השוואה לחודש קודם.' },
      { title: 'גרף יתרת חשבון', desc: 'גרף אזור שמראה את מהלך היתרה לאורך החודש הנוכחי.' },
      { title: 'טאב "החודש"', desc: 'התראות פעילות, המלצות, הוצאות לפי קטגוריה עם ברים ויזואליים, ותקציב מול פועל.' },
      { title: 'טאב "מגמות"', desc: 'ניתוח 6 חודשים אחרונים — גרף הכנסות מול הוצאות, פילוח הוצאות, חריגות שזוהו, וציון יעילות.' },
      { title: 'טאב "נכסים"', desc: 'שווי נקי, פירוט נכסים בגרף עוגה, היסטוריית שווי נקי, וציון בריאות פיננסית עם ציון A–F.' },
      { title: 'טאב "שנתי"', desc: 'השוואה שנתית מול שנה קודמת, גרף חודשי, וסיכום כל הנכסים וההתחייבויות.' },
    ],
    tips: ['הדשבורד מתעדכן אוטומטית עם כל ייבוא נתונים חדש.', 'לחץ על "ניתוח מעמיק" / "תמונה מלאה" בכל סקשן כדי לנווט לדף המלא.'],
  },
  {
    id: 'transactions',
    icon: Receipt,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    label: 'עסקאות',
    link: '/portfolio',
    summary: 'כל תנועות הכסף שלך — הכנסות והוצאות — במקום אחד.',
    features: [
      { title: 'הוספת עסקה ידנית', desc: 'לחץ על "+ עסקה חדשה" להזנת עסקה ידנית עם תאריך, סכום, קטגוריה ותיאור.' },
      { title: 'סינון וחיפוש', desc: 'סנן לפי חודש, קטגוריה, סוג (הכנסה/הוצאה) או חפש לפי תיאור חופשי.' },
      { title: 'עריכה ומחיקה', desc: 'לחץ על עסקה כדי לערוך אותה או למחוק.' },
      { title: 'ייבוא אוטומטי', desc: 'הכפתור "ייבוא אוטומטי" בראש הדף מוביל לסנכרון ישיר עם הבנק.' },
      { title: 'פילוח לפי קטגוריה', desc: 'כל עסקה משויכת לקטגוריה — משפיע ישירות על הניתוחים בדשבורד.' },
    ],
    tips: ['עסקאות שמיובאות אוטומטית מסומנות עם מקור הייבוא.', 'ניתן לשנות קטגוריה בלחיצה על העסקה.'],
  },
  {
    id: 'budget',
    icon: Wallet,
    color: '#10b981',
    bg: '#f0fdf4',
    label: 'תקציב',
    link: '/budget',
    summary: 'הגדר תקרות חודשיות לכל קטגוריה ועקוב אחר הביצוע בזמן אמת.',
    features: [
      { title: 'הגדרת תקציב לקטגוריה', desc: 'בחר קטגוריה, הגדר תקרה חודשית, ומיד תראה מה הוצאת עד עכשיו.' },
      { title: 'ברי התקדמות', desc: 'כל קטגוריה מוצגת עם בר ירוק/כתום/אדום — ירוק: בסדר, כתום: מעל 80%, אדום: חריגה.' },
      { title: 'סיכום חודשי', desc: 'בראש הדף מוצג סיכום כמה תקצבת בסך הכל ומה ניצלת.' },
      { title: 'העתקת תקציב', desc: 'ניתן להעתיק את הגדרות החודש הקודם כנקודת פתיחה.' },
    ],
    tips: ['הגדר תקציב ראשי "שונות" לפריטים לא מתוכננים.', 'התקציב מחושב מחדש בכל תחילת חודש.'],
  },
  {
    id: 'recurring',
    icon: RefreshCw,
    color: '#f59e0b',
    bg: '#fffbeb',
    label: 'תשלומים קבועים',
    link: '/recurring',
    summary: 'עקוב אחר הוצאות שחוזרות כל חודש — שכר דירה, מנויים, ביטוחים.',
    features: [
      { title: 'הגדרת תשלום קבוע', desc: 'הוסף שם, סכום, קטגוריה ותאריך חיוב חודשי. המערכת תזכיר לך לפני כל חיוב.' },
      { title: 'מצב פעיל/לא פעיל', desc: 'ניתן להשהות תשלום קבוע זמנית מבלי למחוק אותו.' },
      { title: 'סיכום עלות חודשית', desc: 'הדף מראה את סך ההוצאות הקבועות כולל פירוט לפי קטגוריה.' },
      { title: 'התראות', desc: 'כשמגיע תאריך החיוב, מופיעה התראה בדשבורד.' },
    ],
    tips: ['רשום כאן נטפליקס, חשמל, ביטוח — כל דבר שחוזר כל חודש.', 'תשלומים קבועים נכללים אוטומטית בחישוב התקציב.'],
  },
  {
    id: 'categories',
    icon: Layers,
    color: '#ec4899',
    bg: '#fdf2f8',
    label: 'קטגוריות',
    link: '/categories',
    summary: 'ניתוח עמוק של ההוצאות לפי קטגוריה — אחוזים, מגמות ותובנות.',
    features: [
      { title: 'פילוח הוצאות', desc: 'גרף עוגה ורשימת קטגוריות עם הסכום הכולל לכל קטגוריה בחודש הנבחר.' },
      { title: 'מגמה לאורך זמן', desc: 'גרף קו שמראה כמה הוצאת בכל קטגוריה לאורך חצי שנה.' },
      { title: 'השוואה לחודש קודם', desc: 'חץ ירוק/אדום ליד כל קטגוריה מראה אם ירדת או עלית ביחס לחודש שעבר.' },
      { title: 'חיפוש ומיון', desc: 'מיין לפי סכום, שם, או מספר עסקאות.' },
    ],
    tips: ['כל שינוי בעסקה (קטגוריה) מתעדכן מיד גם כאן.'],
  },
  {
    id: 'import',
    icon: DownloadCloud,
    color: '#06b6d4',
    bg: '#ecfeff',
    label: 'ייבוא נתונים',
    link: '/import/auto',
    summary: 'שלוש דרכים לייבא עסקאות — אוטומטי, אקסל, או ישיר מדיסקונט.',
    features: [
      { title: 'ייבוא אוטומטי (Scraper)', desc: 'הזן שם משתמש וסיסמת בנק ומערכת ה-Scraper תמשוך את כל העסקאות ישירות. תומך בבנק הפועלים, לאומי, מזרחי, ויזה כאל ועוד.' },
      { title: 'ייבוא אקסל', desc: 'הורד קובץ CSV/XLS מהאתר של הבנק ויבא אותו. המערכת תזהה אוטומטית את עמודות התאריך, הסכום והתיאור.' },
      { title: 'ייבוא דיסקונט', desc: 'חיבור ישיר לאפליקציית בנק דיסקונט ללא צורך בסיסמה — דרך אימות Open Banking.' },
      { title: 'כאל — ייבוא ישיר', desc: 'ייבוא ישיר מחברת כאל לכרטיסי אשראי.' },
      { title: 'מניעת כפילויות', desc: 'המערכת מזהה עסקאות שכבר קיימות ולא מייבאת אותן פעמיים.' },
    ],
    tips: ['מומלץ לייבא פעם בשבוע לשמירה על עדכניות.', 'הסיסמאות לא נשמרות בשרת — הן עוברות ישירות ל-Scraper.'],
  },
  {
    id: 'investments',
    icon: TrendingUp,
    color: '#10b981',
    bg: '#f0fdf4',
    label: 'השקעות וחיסכון',
    link: '/investments',
    summary: 'עקוב אחר כל ההון שלך — מניות, פיקדונות, קרנות, פנסיה ומט"ח.',
    features: [
      { title: 'מניות', desc: 'הוסף פוזיציות במניות — מחיר כניסה, כמות, תאריך. המערכת מחשבת רווח/הפסד לא ממומש.', link: '/investments' },
      { title: 'פיקדונות', desc: 'תעד פיקדונות בנקאיים עם ריבית ותאריך פקיעה. כולל חישוב ריבית צפויה.', link: '/deposits' },
      { title: 'קרנות נאמנות / ETF', desc: 'מעקב אחר קרנות עם שווי שוק עדכני.', link: '/funds' },
      { title: 'פנסיה', desc: 'הזן את יתרת הפנסיה, הקרן המנהלת וצפי קצבה. המערכת מחשבת צבירה צפויה לגיל פרישה.', link: '/pension' },
      { title: 'מט"ח', desc: 'עקוב אחר כסף זר — דולר, אירו, ועוד — כולל שווי שקלי עדכני.', link: '/foreign-currency' },
    ],
    tips: ['כל הנכסים האלו נכללים אוטומטית בחישוב השווי הנקי.', 'עדכן ערכים אחת לחודש לדיוק מרבי.'],
  },
  {
    id: 'assets',
    icon: Home,
    color: '#f59e0b',
    bg: '#fffbeb',
    label: 'נכסים והתחייבויות',
    link: '/real-estate',
    summary: 'נדל"ן, משכנתאות, הלוואות, חובות וחיסכון לילדים — מעקב מלא.',
    features: [
      { title: 'נדל"ן', desc: 'הוסף נכסי נדל"ן — שווי שוק, עלות רכישה, הכנסות שכירות. מחשב ROI ורווח על הנייר.', link: '/real-estate' },
      { title: 'משכנתא', desc: 'הזן את פרטי המשכנתא — יתרה, ריבית, מסלול. כולל גרף סילוקין ולוח תשלומים.', link: '/mortgage' },
      { title: 'הלוואות', desc: 'עקוב אחר הלוואות אישיות — כמה נשאר, מתי נגמר, כמה ריבית שולמה.', link: '/my-loans' },
      { title: 'חובות', desc: 'רשום חובות לאנשים פרטיים — מי חייב לך ואתה חייב למי.', link: '/debts' },
      { title: 'חיסכון ילדים', desc: 'עקוב אחר קרנות ילד לכל ילד — יתרה, ריבית, גיל פרישה מתוכנן.', link: '/child-savings' },
    ],
    tips: ['נכסים + השקעות − התחייבויות = השווי הנקי שלך.'],
  },
  {
    id: 'planning',
    icon: Target,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    label: 'תכנון',
    link: '/goals',
    summary: 'יעדים פיננסיים, מעשרות, ביטוח, מס ופרויקטים.',
    features: [
      { title: 'יעדים', desc: 'הגדר יעד (רכישת דירה, חופשה, רכב) עם סכום יעד ותאריך. המערכת מראה כמה לחסוך בחודש כדי להגיע.', link: '/goals' },
      { title: 'מעשרות', desc: 'עקוב אחר נתינת מעשרות — כמה חייב לפי הכנסותיך, כמה נתת, יתרה לנתינה.', link: '/maaser' },
      { title: 'ביטוח', desc: 'תיעוד כל הביטוחים — חיים, בריאות, רכב — כולל פרמיה חודשית ומועד חידוש.', link: '/insurance' },
      { title: 'מחשבון מס', desc: 'חישוב מס הכנסה צפוי לפי הכנסות שנתיות, נקודות זיכוי ומסלול מיסוי.', link: '/tax' },
      { title: 'פרויקטים', desc: 'נהל פרויקטים פיננסיים (שיפוץ, עסק) עם תקציב, הוצאות בפועל ואחוז התקדמות.', link: '/projects' },
    ],
    tips: ['יעדים מוצגים גם בדשבורד הראשי תחת "3 דברים לעשות עכשיו".'],
  },
  {
    id: 'family',
    icon: Users,
    color: '#ec4899',
    bg: '#fdf2f8',
    label: 'אזור משפחתי',
    link: '/family',
    summary: 'שתף את כל נתוני הפיננסים עם בן/בת הזוג — שניכם רואים אותו חשבון.',
    features: [
      { title: 'יצירת קבוצה משפחתית', desc: 'לחץ על "צור קבוצה" ותקבל קוד הזמנה ייחודי של 8 תווים.' },
      { title: 'הצטרפות עם קוד', desc: 'בן/בת הזוג נכנסים לאזור המשפחתי, מזינים את הקוד ומיד רואים את כל הנתונים המשותפים.' },
      { title: 'נתונים משותפים', desc: 'כל הדפים — עסקאות, תקציב, נכסים, ניתוחים — מציגים נתונים של כל בני הקבוצה.' },
      { title: 'ניהול חברים', desc: 'ראה את רשימת חברי הקבוצה, מי יצר אותה (מוצג בכתר 👑), ואפשרות לעזוב.' },
      { title: 'שינוי שם הקבוצה', desc: 'לחץ על עריכת שם הקבוצה כדי לשנות אותו.' },
    ],
    tips: ['שנה את קוד ההזמנה על ידי יצירת קבוצה חדשה אם הקוד נחשף.', 'עזיבת הקבוצה לא מוחקת את הנתונים שלך — רק מנתקת את השיתוף.'],
  },
  {
    id: 'networth',
    icon: Scale,
    color: '#3b82f6',
    bg: '#eff6ff',
    label: 'שווי נקי ובריאות פיננסית',
    link: '/net-worth',
    summary: 'כמה שווה כל הרכוש שלך בניכוי כל החובות — ועם ציון בריאות פיננסית.',
    features: [
      { title: 'שווי נקי', desc: 'סכום כל הנכסים (פיקדונות + מניות + פנסיה + נדל"ן...) פחות כל החובות (משכנתא + הלוואות...).' },
      { title: 'ציון בריאות A–F', desc: 'ציון אוטומטי שמתחשב ביחס חוב/הכנסה, קרן חירום, פנסיה, פיזור השקעות ועוד.' },
      { title: 'היסטוריית שווי נקי', desc: 'גרף שמראה כיצד השווי הנקי שלך השתנה לאורך 12 חודשים.' },
      { title: 'כלל ה-72', desc: 'מחשבון אינטראקטיבי: בכמה שנים הכסף שלך יוכפל לפי שיעור ריבית שתבחר.' },
      { title: 'טיפים לשיפור', desc: 'המערכת מציגה עד 5 טיפים אישיים להעלאת הציון — לפי המצב הספציפי שלך.' },
    ],
    tips: ['הציון מתעדכן אוטומטית כשמוסיפים נכסים חדשים.', 'ציון A ומעלה מושג כשיחס חוב/הכנסה נמוך מ-30%.'],
  },
  {
    id: 'reports',
    icon: BarChart3,
    color: '#f59e0b',
    bg: '#fffbeb',
    label: 'דוחות מתקדמים',
    link: '/reports',
    summary: 'השוואה שנתית, מגמות ארוכות טווח, וסיכום כולל.',
    features: [
      { title: 'השוואה שנתית', desc: 'השוואת הכנסות, הוצאות וחיסכון בין השנה הנוכחית לשנה קודמת — כולל גרף חודשי.' },
      { title: 'מגמות', desc: 'בחר תקופה (3/6/12 חודשים) וראה גרף מגמה של כל קטגוריות ההוצאה.' },
      { title: 'סיכום כולל', desc: 'טבלה עם כל הנכסים, ההתחייבויות, ההכנסות וההוצאות שלך — תמונה מלאה.' },
    ],
    tips: ['הדוחות נגישים גם דרך טאב "שנתי" בלוח הבקרה.'],
  },
  {
    id: 'analytics',
    icon: Zap,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    label: 'ניתוח חכם',
    link: '/smart-analytics',
    summary: 'ניתוחים מתקדמים — חריגות, דפוסי הוצאה, תחזיות וניתוח עונתי.',
    features: [
      { title: 'מגמות הכנסה/הוצאה', desc: 'גרף BarChart + Area שמראה תנועת הכסף לפי תקופה שתבחר (חודש / 3 חודשים / שנה).' },
      { title: 'קטגוריות', desc: 'PieChart + BarChart אופקי עם פירוט מלא של ההוצאות לפי קטגוריה.' },
      { title: 'חריגות', desc: 'המערכת מזהה עסקאות חריגות בהשוואה לממוצע שלך — לא רכישות בלתי-צפויות.' },
      { title: 'דפוסים', desc: 'באיזה יום בשבוע אתה מוציא הכי הרבה? מה הסכום הממוצע לעסקה?' },
      { title: 'ניתוח עונתי', desc: 'האם יש חודשים שתמיד יקרים לך יותר? הניתוח העונתי חושף את הדפוסים.' },
      { title: 'ציון יעילות', desc: 'ציון 0–100 שמשקלל כמה יעיל השימוש בכסף שלך לאורך התקופה שנבחרה.' },
      { title: 'סיווג אוטומטי', desc: 'כפתור "סיווג אוטומטי" מריץ אלגוריתם שמשייך עסקאות ללא קטגוריה לקטגוריה המתאימה ביותר.' },
    ],
    tips: ['שנה את טווח התאריכים בכל פעם — הניתוח מחושב מחדש.', 'קוד הצבעים: ירוק = הכנסות, אדום = הוצאות.'],
  },
  {
    id: 'alerts',
    icon: Bell,
    color: '#ef4444',
    bg: '#fef2f2',
    label: 'התראות',
    link: '/alerts',
    summary: 'התראות חכמות שמזהירות אותך לפני שיש בעיה.',
    features: [
      { title: 'חריגת תקציב', desc: 'כשמוציא יותר מ-80% מהתקציב בקטגוריה — מיד מגיעה התראה.' },
      { title: 'הוצאה גבוהה במיוחד', desc: 'עסקה שהרבה יותר גבוהה מהממוצע שלך מסומנת כחריגה.' },
      { title: 'יעד קרוב לפקיעה', desc: 'כשיעד פיננסי מתקרב לתאריך היעד עם פער גדול — תקבל התראה.' },
      { title: 'תשלום קבוע מתקרב', desc: 'ימים לפני תשלום קבוע — תזכורת כדי לוודא שיש כסף בחשבון.' },
      { title: 'סימון כנקרא', desc: 'לחץ "סמן כנקרא" לניקוי ההתראה. ניתן לנקות הכל בבת אחת.' },
    ],
    tips: ['התראות מופיעות גם בטאב "החודש" בלוח הבקרה.'],
  },
  {
    id: 'automation',
    icon: Cpu,
    color: '#06b6d4',
    bg: '#ecfeff',
    label: 'אוטומציה',
    link: '/management',
    summary: 'כלים לניהול ואוטומציה של תהליכים חוזרים.',
    features: [
      { title: 'סיווג אוטומטי', desc: 'הרץ אלגוריתם שמסווג עסקאות ללא קטגוריה על פי היסטוריית עסקאות דומות.' },
      { title: 'כללי סיווג', desc: 'הגדר כלל: "כל עסקה עם המילה סופרפארם → קטגוריית בריאות".' },
      { title: 'ייבוא מתוזמן', desc: 'הגדר ייבוא אוטומטי שמתבצע בתאריך קבוע בכל חודש.' },
    ],
    tips: ['כללי סיווג חוסכים הרבה זמן אם הבנק לא מסווג עסקאות.'],
  },
];

// ─── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-right hover:bg-slate-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: section.bg }}>
          <Icon className="h-5 w-5" style={{ color: section.color }} />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-bold text-slate-800 text-sm">{section.label}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{section.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={section.link}
            onClick={e => e.stopPropagation()}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
            style={{ background: section.bg, color: section.color }}
          >
            פתח
          </Link>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-50 px-5 pb-5 pt-4 space-y-5">
          {/* Features */}
          <div className="space-y-3">
            {section.features.map((f, i) => (
              <div key={i} className="flex gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: section.color }} />
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {f.title}
                    {f.link && (
                      <Link to={f.link} className="mr-2 text-xs font-normal text-blue-500 hover:underline">← נסה</Link>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {section.tips?.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">טיפים</p>
              {section.tips.map((tip, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-600">
                  <span className="text-amber-400 shrink-0 mt-0.5">💡</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div className="min-h-screen bg-[#F2F4F8]" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-7 text-white">
          <div className="flex items-center gap-3 mb-3">
            <HelpCircle className="h-7 w-7 text-blue-200" />
            <h1 className="text-2xl font-black tracking-tight">מדריך השימוש ב-Fina</h1>
          </div>
          <p className="text-blue-100 text-sm leading-relaxed max-w-xl">
            כאן תמצא הסבר מפורט על כל פיצ'ר באפליקציה — מהוספת עסקה ועד ניתוח שנתי, מייבוא אוטומטי ועד אזור משפחתי.
            לחץ על כל קטע להרחבה.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link to="/finance-dashboard" className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <LayoutDashboard className="h-4 w-4" /> לוח בקרה
            </Link>
            <Link to="/import/auto" className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <DownloadCloud className="h-4 w-4" /> ייבוא נתונים
            </Link>
            <Link to="/family" className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Users className="h-4 w-4" /> אזור משפחתי
            </Link>
          </div>
        </div>

        {/* Quick Start */}
        <div>
          <h2 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            איך מתחילים — 4 צעדים
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_STEPS.map((step) => (
              <div key={step.num} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center font-black text-blue-600 text-sm shrink-0">{step.num}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-base">{step.icon}</span>
                    <p className="font-bold text-slate-800 text-sm">{step.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-2">{step.desc}</p>
                  <Link to={step.link} className="text-xs font-semibold text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                    {step.linkLabel} <ArrowLeft className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sync explanation */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-5 w-5 text-indigo-500" />
            <h2 className="text-sm font-black text-indigo-800">הסנכרון המלא — איך הכל מחובר</h2>
          </div>
          <div className="space-y-2 text-xs text-indigo-700 leading-relaxed">
            <p>📌 <strong>עסקאות → הכל:</strong> כל עסקה שמוספת (ידנית או ייבוא) מתעדכנת אוטומטית בתקציב, קטגוריות, דשבורד וניתוחים.</p>
            <p>📌 <strong>נכסים → שווי נקי:</strong> כל נכס שמוסיפים (פיקדון, מניה, נדל"ן) נכלל אוטומטית בחישוב השווי הנקי.</p>
            <p>📌 <strong>קטגוריות → תקציב:</strong> שינוי קטגוריה של עסקה מתעדכן מיד בתקציב ובניתוחים.</p>
            <p>📌 <strong>אזור משפחתי → כל הדפים:</strong> ברגע שמצטרפים לקבוצה, כל הדפים מציגים נתונים של כל חברי הקבוצה יחד.</p>
            <p>📌 <strong>תשלומים קבועים → תקציב:</strong> תשלומים קבועים נכלאים בחישוב ה"צפוי" בתקציב החודשי.</p>
            <p>📌 <strong>יעדים ← ניתוח:</strong> הניתוח החכם לוקח בחשבון את היעדים שלך בהמלצות ובציון הבריאות הפיננסית.</p>
          </div>
        </div>

        {/* All sections */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-slate-800">כל הפיצ'רים — פירוט מלא</h2>
            <button
              onClick={() => setExpandAll(v => !v)}
              className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors"
            >
              {expandAll ? 'כווץ הכל' : 'פרוס הכל'}
            </button>
          </div>
          <div className="space-y-2">
            {SECTIONS.map(section => (
              <ExpandableSection key={section.id} section={section} forceOpen={expandAll} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pb-4">
          <p>יש שאלה שלא ענינו עליה? <Link to="/suggestions" className="text-blue-500 hover:underline">שלח הצעה לשיפור</Link></p>
        </div>

      </div>
    </div>
  );
}

// Controlled by parent forceOpen
function ExpandableSection({ section, forceOpen }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen || localOpen;
  const Icon = section.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setLocalOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-right hover:bg-slate-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: section.bg }}>
          <Icon className="h-5 w-5" style={{ color: section.color }} />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-bold text-slate-800 text-sm">{section.label}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{section.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={section.link}
            onClick={e => e.stopPropagation()}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
            style={{ background: section.bg, color: section.color }}
          >
            פתח
          </Link>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-50 px-5 pb-5 pt-4 space-y-5">
          <div className="space-y-3">
            {section.features.map((f, i) => (
              <div key={i} className="flex gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: section.color }} />
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {f.title}
                    {f.link && (
                      <Link to={f.link} className="mr-2 text-xs font-normal text-blue-500 hover:underline">← נסה</Link>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {section.tips?.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">טיפים</p>
              {section.tips.map((tip, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-600">
                  <span className="text-amber-400 shrink-0">💡</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
