# Fina Android — Feature Parity

מסך מסומן `Done` רק כאשר קיימים UI מלא, כל פעולות השרת, מצבי loading/empty/error, ואימות build.

| אזור | מסך | מצב |
|---|---|---|
| Auth | Login + register + session restore + logout + profile/password | Partial |
| Auth | Google login | Pending |
| כספים | Dashboard | Partial |
| כספים | Transactions: list/search/filter/add/edit/delete | Partial |
| כספים | Transactions: monthly paging/import/merchant bulk | Pending |
| כספים | Categories: list/add/delete/sync | Partial |
| כספים | Budget: monthly view/edit/delete/category limits | Partial |
| כספים | Recurring: list/add/edit/delete/pause | Partial |
| כספים | Merchants | Pending |
| השקעות | Stocks: list/add/refresh/sell/delete | Partial |
| השקעות | Deposits: list/add/break/withdraw | Partial |
| השקעות | Funds / Pension / FX | Pending |
| נכסים | Real estate / Mortgage / Loans / Debt / Child savings | Pending |
| תכנון | Business / Goals / Maaser / Family / Insurance / Tax / Projects | Pending |
| ניהול | Reports / Analytics / Imports / Automation / Suggestions | Pending |
| ייבוא | Automatic banks/cards + CAL OTP + One Zero OTP + mapping/commit | Partial |
| מערכת | Settings / Help / Alerts | Pending |
| Admin | Users / Logs / Activity | Pending |

## כללי השלמה

- ללא מסכי placeholder בספירת הכיסוי.
- פעולות מחיקה ושינוי כספי דורשות אישור ברור.
- ניווט RTL, נגישות, dark mode ומסכים קטנים נבדקים בכל מודול.
- חוזי הנתונים נלקחים מה־server ולא מניחושים לפי ה־UI של האתר.
