// client/src/pages/RegisterPage.jsx

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "@/utils/api";
import { Eye, EyeOff, Check, X, Clock } from "lucide-react";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(null); // message after a successful access request
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // משיכת טוקן CSRF
  useEffect(() => {
    api
      .get("/csrf-token", { withCredentials: true })
      .catch((err) => console.error("CSRF Error:", err));
  }, []);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // ולידציה
  const validatePassword = (password) => {
    if (password.length < 8) return "הסיסמה חייבת להכיל לפחות 8 תווים";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("הסיסמאות לא תואמות");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post(
        "/auth/register",
        {
          name: form.name,
          email: form.email,
          password: form.password,
        }
      );
      // ההרשמה היא בקשת גישה — אין סשן עד שמנהל מאשר
      setSubmitted(data?.message || "הבקשה התקבלה ותיבדק על ידי מנהל המערכת.");
    } catch (err) {
      setError(err.response?.data?.message || "אירעה שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-canvas min-h-screen flex w-full font-sans" dir="rtl">
      
      {/* צד ימין: אזור הטופס */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8 lg:px-16 xl:px-24 z-10">
        <div className="w-full max-w-sm space-y-8">
          
          {submitted ? (
            <div className="text-center sm:text-right space-y-5" role="status">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock className="h-7 w-7" />
              </div>
              <h2 className="font-display text-3xl font-semibold text-slate-950 tracking-[-0.03em]">הבקשה נשלחה</h2>
              <p className="text-sm leading-6 text-gray-600">{submitted}</p>
              <p className="text-sm leading-6 text-gray-500">
                אחרי האישור אפשר להתחבר עם <span dir="ltr" className="font-medium text-slate-700">{form.email}</span> והסיסמה שבחרת.
              </p>
              <Link to="/login" className="inline-flex w-full justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black">
                למסך ההתחברות
              </Link>
            </div>
          ) : (
          <>
          <div className="text-center sm:text-right">
            <p className="eyebrow">בקשת גישה</p>
            <h2 className="font-display text-4xl font-semibold text-slate-950 tracking-[-0.04em]">
              הצטרפות ל-Fina
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              הגישה למערכת באישור מנהל. מלאו את הפרטים ונעדכן כשהבקשה תאושר.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 border-r-4 border-red-500 flex items-start">
              <X className="h-5 w-5 text-red-500 ml-3 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              
              {/* שם מלא */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1">
                  שם מלא
                </label>
                <div className="mt-1">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 bg-white rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-colors text-base"
                    placeholder="ישראל ישראלי"
                  />
                </div>
              </div>

              {/* אימייל */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
                  כתובת אימייל
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    style={{ direction: 'ltr', textAlign: 'right' }} 
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 bg-white rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-colors text-base"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              {/* סיסמה */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                  סיסמה
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={handleChange}
                    style={{ direction: 'ltr' }}
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 bg-white rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-colors text-base text-right pr-12"
                  />
                  <div className="absolute inset-y-0 right-0 pl-3 flex items-center pr-3 cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <Check className={`h-3 w-3 ml-1 ${form.password.length >= 8 ? 'text-green-500' : 'text-gray-300'}`} />
                  מינימום 8 תווים
                </div>
              </div>

              {/* אימות סיסמה */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1">
                  אימות סיסמה
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={form.confirmPassword}
                    onChange={handleChange}
                    style={{ direction: 'ltr' }}
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 bg-white rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-colors text-base text-right"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors active:translate-y-px"
              >
                {loading ? (
                  <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                   "שליחת בקשת גישה"
                )}
              </button>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                כבר רשום?{" "}
                <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                  התחבר לחשבון
                </Link>
              </p>
            </div>

          </form>
          </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex relative w-0 flex-1 overflow-hidden bg-slate-950 text-white items-end">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full border border-blue-400/15" />
        <div className="absolute right-16 top-20 grid grid-cols-2 gap-4 opacity-90">
          {[42, 68, 55, 84].map((value, index) => (
            <div key={value} className={`h-28 w-36 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur ${index % 2 ? 'translate-y-8' : ''}`}>
              <div className="mb-5 h-2 w-12 rounded-full bg-blue-400/60" />
              <div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-400" style={{ width: `${value}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="relative p-16 pb-20 xl:p-20">
          <p className="mb-4 text-xs font-semibold tracking-[0.12em] text-blue-300">fina למשפחה שלך</p>
          <h3 className="font-display text-5xl font-semibold leading-tight mb-5">פחות רעש.<br />יותר החלטות טובות.</h3>
          <p className="text-lg leading-8 text-slate-400 max-w-md">כל החשבונות, היעדים וההרגלים הפיננסיים שלך — מחוברים לתמונה אחת.</p>
        </div>
      </div>
    </div>
  );
}
