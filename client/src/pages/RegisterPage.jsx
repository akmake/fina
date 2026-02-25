// client/src/pages/RegisterPage.jsx

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/utils/api";
import { useAuthStore } from "@/stores/authStore";
import { Eye, EyeOff, Check, X, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const loginAction = useAuthStore((s) => s.login);
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
    axios
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
      if (data.user) loginAction(data.user);
      navigate("/finance-dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "אירעה שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] md:min-h-screen flex w-full bg-white font-sans" dir="rtl">
      
      {/* צד ימין: אזור הטופס */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white z-10">
        <div className="w-full max-w-sm space-y-8">
          
          <div className="text-center sm:text-right">
            <h2 className="mt-6 text-4xl font-extrabold text-gray-900 tracking-tight">
              יצירת חשבון
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              הצטרף אלינו וקבל שליטה מלאה על הכספים שלך.
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
                    className="appearance-none block w-full px-4 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
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
                    className="appearance-none block w-full px-4 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              {/* סיסמה */}
              <div>
                <label htmlFor="password" class="block text-sm font-semibold text-gray-700 mb-1">
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
                    className="appearance-none block w-full px-4 py-3.5 border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base text-right pr-12" // pr-12 for icon space if LTR, but here we handle explicitly
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
                <label htmlFor="confirmPassword" class="block text-sm font-semibold text-gray-700 mb-1">
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
                    className="appearance-none block w-full px-4 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base text-right"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform active:scale-[0.98]"
              >
                {loading ? (
                  <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                   "הירשם למערכת"
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
        </div>
      </div>

      {/* צד שמאל: תמונה גדולה */}
      <div className="hidden lg:block relative w-0 flex-1 overflow-hidden">
        {/* שימוש בתמונה חיצונית איכותית מאנספלאש */}
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80"
          alt="Office Background"
        />
        {/* שכבת כיסוי עדינה כדי שהתמונה לא תהיה רועשת מדי */}
        <div className="absolute inset-0 bg-blue-900/20 mix-blend-multiply"></div>
        
        <div className="absolute inset-0 flex flex-col justify-end p-20 pb-24 bg-gradient-to-t from-black/60 via-transparent to-transparent">
            <h3 className="text-4xl font-bold text-white mb-4">ניהול חכם, עתיד בטוח.</h3>
            <p className="text-lg text-gray-200 max-w-md">המערכת המתקדמת לניהול התקציב שלך, בקלות ובנוחות מכל מקום.</p>
        </div>
      </div>
    </div>
  );
}