import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  RefreshCw, Trash2, DollarSign, Loader2, PlusCircle, MoreHorizontal,
  ArrowUpRight, ArrowDownRight, TrendingUp, Briefcase, BarChart2,
} from 'lucide-react';

import api from '@/utils/api';
import { formatCurrency, formatUSD } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------
class StocksErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('StocksManager error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-600 p-6 border border-red-300 bg-red-50 rounded-lg">
          <h2 className="font-bold text-lg mb-2">שגיאה בטעינת רכיב המניות</h2>
          <p className="text-sm">{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// StocksManager
// ---------------------------------------------------------------------------
function StocksManager() {
  const [stocks,    setStocks]    = useState([]);
  const [accounts,  setAccounts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState(null);

  // Add stock dialog
  const [isAddOpen, setAddOpen]   = useState(false);
  const [ticker,         setTicker]         = useState('');
  const [purchasePrice,  setPurchasePrice]  = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [sourceAccount,  setSourceAccount] = useState('ללא הורדה');

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState({ open: false, stockId: null, ticker: '' });
  const [confirmSell,   setConfirmSell]   = useState({ open: false, stockId: null, ticker: '' });

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [stocksRes, accountsRes] = await Promise.all([
        api.get('/stocks'),
        api.get('/dashboard/summary'),
      ]);
      setStocks(stocksRes.data || []);
      setAccounts(accountsRes.data?.accounts || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'שגיאה בטעינת הנתונים';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!ticker || !purchasePrice || !investedAmount) {
      return toast.error('יש למלא את כל השדות.');
    }
    try {
      await api.post('/stocks', {
        ticker,
        purchasePrice:  parseFloat(purchasePrice),
        investedAmount: parseFloat(investedAmount),
        sourceAccountName: sourceAccount,
      });
      toast.success(`מניית ${ticker} נוספה בהצלחה!`);
      setTicker(''); setPurchasePrice(''); setInvestedAmount('');
      setAddOpen(false);
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהוספת מניה');
    }
  };

  const handleDeleteStock = async () => {
    const { stockId, ticker: t } = confirmDelete;
    try {
      await api.delete(`/stocks/${stockId}`);
      toast.success(`מניית ${t} נמחקה.`);
      fetchData(true);
    } catch {
      toast.error('שגיאה במחיקת המניה.');
    }
  };

  const handleSellStock = async () => {
    const { stockId, ticker: t } = confirmSell;
    try {
      const { data } = await api.post(`/stocks/${stockId}/sell`);
      toast.success(data.message || `מניית ${t} נמכרה.`);
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה במכירת המניה');
    }
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    const id = toast.loading('מעדכן מחירים...');
    try {
      await api.post('/stocks/refresh-prices');
      await fetchData(true);
      toast.success('המחירים עודכנו.', { id });
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בעדכון מחירים', { id });
    } finally {
      setRefreshing(false);
    }
  };

  // ── Portfolio stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!stocks.length) return { totalValue: 0, totalInvested: 0, pnl: 0, pnlPct: 0 };
    const totalValue    = stocks.reduce((a, s) => a + (s.currentValueILS  || 0), 0);
    const totalInvested = stocks.reduce((a, s) => a + (s.investedAmountILS || 0), 0);
    const pnl    = totalValue - totalInvested;
    const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    return { totalValue, totalInvested, pnl, pnlPct };
  }, [stocks]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-10 bg-red-50 dark:bg-red-900/10 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">תיק ההשקעות שלי</h2>
          <p className="text-slate-500 dark:text-slate-400">סקירה כללית של ביצועי המניות שלך</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefreshPrices} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 me-2 ${refreshing ? 'animate-spin' : ''}`} />
            רענן מחירים
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 me-2" />
                הוסף מניה
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>הוספת מניה חדשה</DialogTitle>
                <DialogDescription>הזן את פרטי הרכישה כדי להוסיף מניה למעקב.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStock} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-end text-sm">Ticker</label>
                  <Input placeholder="AAPL" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} required className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-end text-sm">מחיר קנייה ($)</label>
                  <Input type="number" placeholder="150.25" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required step="0.01" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-end text-sm">סכום השקעה ($)</label>
                  <Input type="number" placeholder="1000" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} required step="0.01" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-end text-sm">מקור</label>
                  <Select onValueChange={setSourceAccount} defaultValue="ללא הורדה">
                    <SelectTrigger className="col-span-3"><SelectValue placeholder="מקור הכסף" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ללא הורדה">ללא הורדה</SelectItem>
                      {accounts.map((acc) => (
                        <SelectItem key={acc._id} value={acc.name}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit">הוסף מניה</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'שווי תיק נוכחי',  value: formatCurrency(stats.totalValue),    icon: Briefcase,  sub: 'ערך כולל בשקלים'           },
          { title: 'סך הכל השקעה',    value: formatCurrency(stats.totalInvested), icon: DollarSign, sub: 'עלות בשקלים'                },
          { title: 'רווח / הפסד',     value: formatCurrency(stats.pnl),           icon: BarChart2,  sub: 'לא ממומש',  pnl: stats.pnl  },
          { title: 'תשואה כוללת',     value: `${stats.pnlPct.toFixed(2)}%`,      icon: TrendingUp, sub: 'על ההשקעה', pnl: stats.pnl  },
        ].map(({ title, value, icon: Icon, sub, pnl: p }) => (
          <Card key={title} className="dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${p !== undefined ? (p >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                {value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-slate-100">המניות שלי</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border dark:border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <TableHead>Ticker</TableHead>
                  <TableHead className="text-end">שווי (₪)</TableHead>
                  <TableHead className="text-end">רווח/הפסד ($)</TableHead>
                  <TableHead className="text-end">יחידות</TableHead>
                  <TableHead className="text-end">מחיר נוכחי ($)</TableHead>
                  <TableHead className="text-end">מחיר קנייה ($)</TableHead>
                  <TableHead>עדכון</TableHead>
                  <TableHead className="text-end">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-slate-500 dark:text-slate-400">
                      עדיין לא הוספת מניות. לחץ על ״הוסף מניה״ כדי להתחיל.
                    </TableCell>
                  </TableRow>
                ) : (
                  stocks.map((stock) => {
                    const profit    = stock.profitUSD || 0;
                    const isProfit  = profit >= 0;
                    const updatedAt = stock.lastUpdated ? new Date(stock.lastUpdated) : null;
                    return (
                      <TableRow key={stock._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-medium">
                          <a
                            href={`https://finance.yahoo.com/quote/${stock.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {stock.ticker}
                          </a>
                        </TableCell>
                        <TableCell className="text-end font-semibold">{formatCurrency(stock.currentValueILS)}</TableCell>
                        <TableCell className="text-end">
                          <Badge variant={isProfit ? 'success' : 'destructive'}>
                            {isProfit ? <ArrowUpRight className="h-3 w-3 me-1" /> : <ArrowDownRight className="h-3 w-3 me-1" />}
                            {formatUSD(profit)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">{(stock.shares || 0).toFixed(4)}</TableCell>
                        <TableCell className="text-end">{formatUSD(stock.currentPrice)}</TableCell>
                        <TableCell className="text-end">{formatUSD(stock.purchasePrice)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {updatedAt && !isNaN(updatedAt)
                            ? updatedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">פתח תפריט</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setConfirmSell({ open: true, stockId: stock._id, ticker: stock.ticker })}
                              >
                                <DollarSign className="h-4 w-4 me-2" />
                                מכור הכל
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
                                onClick={() => setConfirmDelete({ open: true, stockId: stock._id, ticker: stock.ticker })}
                              >
                                <Trash2 className="h-4 w-4 me-2" />
                                מחק לצמיתות
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(o) => setConfirmDelete((s) => ({ ...s, open: o }))}
        title={`מחיקת מניית ${confirmDelete.ticker}`}
        description="פעולה זו אינה הפיכה. המניה תוסר לצמיתות מהתיק שלך."
        confirmLabel="מחק לצמיתות"
        onConfirm={handleDeleteStock}
      />

      <ConfirmDialog
        open={confirmSell.open}
        onOpenChange={(o) => setConfirmSell((s) => ({ ...s, open: o }))}
        title={`מכירת כל מניות ${confirmSell.ticker}`}
        description="כל היחידות יימכרו והרווח/הפסד יירשם. לא ניתן לבטל."
        confirmLabel="מכור הכל"
        variant="default"
        onConfirm={handleSellStock}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------
export default function InvestmentsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <StocksErrorBoundary>
        <StocksManager />
      </StocksErrorBoundary>
    </div>
  );
}
