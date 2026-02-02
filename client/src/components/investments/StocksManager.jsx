import React, { useEffect, useState } from "react";
import { useStockStore } from "@/stores/stockStore";
import { Button } from '@/components/ui/Button';
import { Input } from "@/components/ui/Input";

/**
 * StocksManager.jsx – דף ניהול מניות
 */
const StocksManager = () => {
  // Zustand store actions & state (עם ערכי ברירת־מחדל למניעת קריסה)
  const {
    stocks = [],
    loading = false,
    error = "",
    fetchStocks = () => {},
    addStock = () => {},
    deleteStock = () => {},
    sellStock = () => {},
    refreshPrices = () => {},
  } = useStockStore();

  // טופס מקומי
  const [form, setForm] = useState({
    ticker: "",
    purchasePrice: "",
    investedAmount: "",
  });

  // טעינת נתונים פעם אחת
  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    await addStock({
      ...form,
      purchasePrice: Number(form.purchasePrice),
      investedAmount: Number(form.investedAmount),
    });
    setForm({ ticker: "", purchasePrice: "", investedAmount: "" });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">ניהול מניות</h1>

      {/* טופס הוספה */}
      <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-4">
        <Input name="ticker" value={form.ticker} onChange={handleChange} placeholder="סימול" required />
        <Input
          name="purchasePrice"
          type="number"
          min="0"
          step="0.01"
          value={form.purchasePrice}
          onChange={handleChange}
          placeholder="מחיר קנייה ($)"
          required
        />
        <Input
          name="investedAmount"
          type="number"
          min="0"
          step="0.01"
          value={form.investedAmount}
          onChange={handleChange}
          placeholder="סכום השקעה ($)"
          required
        />
        <Button type="submit" disabled={loading} size="sm">
          הוסף
        </Button>
      </form>

      {error && <p className="text-red-600">{error}</p>}
      {loading && <p>טוען...</p>}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">רשימת מניות</h2>
        <Button variant="secondary" size="sm" onClick={refreshPrices} disabled={loading}>
          רענן מחירים
        </Button>
      </div>

      {/* טבלה */}
      {stocks.length === 0 ? (
        <p className="text-gray-500">אין מניות להצגה.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm rtl text-right">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1">סימול</th>
                <th className="px-2 py-1">מחיר קנייה ($)</th>
                <th className="px-2 py-1">כמות</th>
                <th className="px-2 py-1">מחיר נוכחי ($)</th>
                <th className="px-2 py-1">P/L ($)</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => {
                const shares = s.investedAmount / s.purchasePrice;
                const profit = (s.currentPrice - s.purchasePrice) * shares;
                return (
                  <tr key={s._id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1 font-medium">{s.ticker}</td>
                    <td className="px-2 py-1">{s.purchasePrice.toFixed(2)}</td>
                    <td className="px-2 py-1">{shares.toFixed(4)}</td>
                    <td className="px-2 py-1">{s.currentPrice.toFixed(2)}</td>
                    <td className={`px-2 py-1 ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>{profit.toFixed(2)}</td>
                    <td className="px-2 py-1 flex gap-2 justify-end">
                      <Button size="xs" onClick={() => sellStock(s._id)}>
                        מכור
                      </Button>
                      <Button size="xs" variant="destructive" onClick={() => deleteStock(s._id)}>
                        מחק
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StocksManager;
