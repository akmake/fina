import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12" dir="rtl">
      <Helmet>
        <title>מדיניות פרטיות ותנאי שימוש | Fina</title>
      </Helmet>

      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-8"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לאפליקציה
      </Link>

      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">מדיניות פרטיות ותנאי שימוש</h1>
      <p className="text-sm text-gray-500 mb-10">עדכון אחרון: מרץ 2026</p>

      {/* Privacy Policy */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">מדיניות פרטיות</h2>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">1. מידע שאנו אוספים</h3>
            <p>
              כאשר אתם נרשמים לשירות Fina, אנו אוספים את המידע הבא:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 pr-4">
              <li>שם מלא וכתובת אימייל (בעת הרשמה)</li>
              <li>נתוני Google (שם, אימייל, תמונת פרופיל) — בהתחברות עם Google בלבד</li>
              <li>נתונים פיננסיים שאתם מזינים ידנית (עסקאות, הלוואות, השקעות וכד')</li>
              <li>מידע טכני: כתובת IP, סוג דפדפן, מערכת הפעלה</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">2. שימוש במידע</h3>
            <p>המידע שנאסף משמש אך ורק למטרות הבאות:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 pr-4">
              <li>מתן השירות — הצגת הנתונים הפיננסיים שלכם</li>
              <li>אבטחת החשבון ומניעת גישה לא מורשית</li>
              <li>שיפור חוויית המשתמש</li>
            </ul>
            <p className="mt-2 font-medium text-gray-800">אנו לא מוכרים, משתפים או מעבירים את המידע שלכם לצד שלישי.</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">3. אבטחת מידע</h3>
            <p>
              כל הנתונים מוצפנים בהעברה (HTTPS/TLS). סיסמאות מאוחסנות כ-hash בלבד ואינן ניתנות לשחזור.
              טוקני אימות מאוחסנים בcookies מאובטחים עם הגנת HttpOnly.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">4. Google OAuth</h3>
            <p>
              בעת התחברות עם Google, אנו מקבלים גישה לשם ולאימייל בלבד, בהתאם להרשאות שאישרתם.
              אנו לא ניגשים לתיבת הדואר, ליומן, לאנשי קשר, או לכל שירות Google אחר.
              לביטול ההרשאות:{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                myaccount.google.com/permissions
              </a>
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">5. זכויותיכם</h3>
            <ul className="list-disc list-inside mt-2 space-y-1 pr-4">
              <li>זכות לעיון בנתונים שנאספו עליכם</li>
              <li>זכות לתיקון נתונים שגויים</li>
              <li>זכות למחיקת החשבון וכל הנתונים הקשורים אליו</li>
            </ul>
            <p className="mt-2">לממש את זכויותיכם, צרו קשר דרך הגדרות החשבון.</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">6. עוגיות (Cookies)</h3>
            <p>
              אנו משתמשים בעוגיות HttpOnly לצורך ניהול הסשן בלבד. אין שימוש בעוגיות שיווקיות או מעקב.
            </p>
          </div>
        </div>
      </section>

      {/* Terms of Service */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">תנאי שימוש</h2>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">1. קבלת התנאים</h3>
            <p>
              השימוש בשירות Fina מהווה הסכמה לתנאים אלה. אם אינכם מסכימים — אנא הימנעו משימוש בשירות.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">2. מהות השירות</h3>
            <p>
              Fina הוא כלי לניהול פיננסי אישי. המידע המוצג הוא על בסיס הנתונים שהזנתם בלבד
              ואינו מהווה ייעוץ פיננסי, השקעתי, מיסויי או משפטי מכל סוג.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">3. אחריות המשתמש</h3>
            <ul className="list-disc list-inside mt-2 space-y-1 pr-4">
              <li>אתם אחראים על שמירת פרטי ההתחברות שלכם</li>
              <li>יש לדווח מיידית על כל פעילות חשודה</li>
              <li>אין להשתמש בשירות למטרות בלתי חוקיות</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">4. הגבלת אחריות</h3>
            <p>
              השירות ניתן "כפי שהוא" (AS IS). איננו אחראים לאי-דיוקים בחישובים הנובעים מנתונים שגויים
              שהוזנו, לאובדן נתונים עקב כשל טכני, או לכל נזק עקיף שייגרם משימוש בשירות.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">5. שינויים בתנאים</h3>
            <p>
              אנו שומרים לעצמנו את הזכות לעדכן תנאים אלה. שינויים מהותיים יפורסמו ב-14 יום מראש.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">6. דין חל</h3>
            <p>תנאים אלה כפופים לדין הישראלי. סמכות השיפוט — בתי המשפט בישראל.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
