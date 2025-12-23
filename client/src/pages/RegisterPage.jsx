// client/src/pages/RegisterPage.jsx

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ברגע שהעמוד עולה – החלץ את ה-CSRF token והשרת יציב אותו בעוגייה XSRF-TOKEN
  useEffect(() => {
    axios
      .get("/csrf-token", { withCredentials: true }) // <-- התיקון כאן, ללא /api
      .catch((err) => console.error("Can't fetch CSRF token:", err));
  }, []);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("הסיסמאות לא תואמות");
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        "/api/auth/register",
        {
          name: form.name,
          email: form.email,
          password: form.password,
        },
        {
          withCredentials: true,              // שולח עוגיות (כולל XSRF-TOKEN)
          headers: {
            // axios ייקרא אוטומטית ל־X-XSRF-TOKEN מתוך העוגייה, 
            // אבל אם הסווג שלך ייחודי אפשר כאן למפות ידנית:
            // "X-CSRF-Token": document.cookie
            //   .split("; ")
            //   .find((c) => c.startsWith("XSRF-TOKEN="))
            //   ?.split("=")[1],
          },
        }
      );
      navigate("/tzitzit");
    } catch (err) {
      setError(err.response?.data?.message || "שגיאה בהרשמה, נסה שוב");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-6 rounded-2xl shadow-md"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">הרשמה</h2>

        {error && (
          <p className="text-center text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        <label className="block mb-4">
          <span className="text-sm font-medium">שם מלא</span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium">אימייל</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm font-medium">סיסמה</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={8}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
        </label>

        <label className="block mb-6">
          <span className="text-sm font-medium">אימות סיסמה</span>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            minLength={8}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "שולח..." : "הירשם"}
        </Button>

        <p className="text-center mt-4 text-sm">
          כבר רשום?{" "}
          <Link to="/login" className="text-primary hover:underline">
            התחבר כאן
          </Link>
        </p>
      </form>
    </div>
  );
}
