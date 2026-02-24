// client/src/pages/LoginPage.jsx

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/utils/api";
import { useAuthStore } from "@/stores/authStore";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const loginAction = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  // משיכת CSRF Token בטעינה
  useEffect(() => {
    api.get('/csrf-token').catch((err) => {
      console.error("Failed to fetch CSRF token", err);
      // לא נציג שגיאה למשתמש בשלב זה כדי לא להלחיץ, רק נרשום בלוג
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const { data } = await api.post('/auth/login', { email, password });
      
      if (data && data.user) {
        loginAction(data.user);
        navigate('/'); 
      } else {
        throw new Error("תגובת השרת אינה מכילה פרטי משתמש.");
      }
    } catch (err) {
      setError(err.response?.data?.message || 'שם המשתמש או הסיסמה שגויים');
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
              ברוכים השבים!
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              הזן את פרטי ההתחברות שלך כדי לגשת למערכת.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 border-r-4 border-red-500 flex items-start animate-pulse">
              <AlertCircle className="h-5 w-5 text-red-500 ml-3 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              
              {/* אימייל */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
                  כתובת אימייל
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pr-10 pl-3 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                    placeholder="name@example.com"
                    style={{ direction: 'ltr', textAlign: 'right' }} 
                  />
                </div>
              </div>

              {/* סיסמה */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" class="block text-sm font-semibold text-gray-700">
                    סיסמה
                  </label>
                  {/* אופציונלי: קישור לשכחתי סיסמה */}
                  <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    שכחת סיסמה?
                  </a>
                </div>
                
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full pr-10 pl-10 py-3.5 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                    placeholder="••••••••"
                    style={{ direction: 'ltr', textAlign: 'right' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
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
                  <Loader2 className="animate-spin h-6 w-6 text-white" />
                ) : (
                   "התחבר למערכת"
                )}
              </button>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                עדיין אין לך חשבון?{" "}
                <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500 inline-flex items-center gap-1 group">
                  הירשם עכשיו
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </Link>
              </p>
            </div>

          </form>
        </div>
      </div>

      {/* צד שמאל: תמונה גדולה (שונה במעט מזו של ההרשמה כדי ליצור גיוון) */}
      <div className="hidden lg:block relative w-0 flex-1 overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80"
          alt="Modern Building"
        />
        {/* שכבת כיסוי כחולה */}
        <div className="absolute inset-0 bg-blue-900/30 mix-blend-multiply"></div>
        
        <div className="absolute inset-0 flex flex-col justify-end p-20 pb-24 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
            <h3 className="text-4xl font-bold text-white mb-4">ניהול השקעות חכם.</h3>
            <p className="text-lg text-gray-100 max-w-md">הנתונים שלך מאובטחים ונגישים מכל מקום, כדי שתוכל לקבל החלטות בזמן אמת.</p>
        </div>
      </div>
    </div>
  );
}