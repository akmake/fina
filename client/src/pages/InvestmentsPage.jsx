import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    RefreshCw, Trash2, DollarSign, LoaderCircle, PlusCircle, MoreHorizontal,
    ArrowUpRight, ArrowDownRight, TrendingUp, Briefcase, BarChart2
} from 'lucide-react';

// Using relative paths to avoid any alias resolution issues
import api from '../utils/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';

// --- Error Boundary Component ---
// This component remains unchanged as it's a robust way to handle errors.
class StocksErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error in StocksManager:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-600 p-4 border border-red-500 bg-red-50 rounded-lg">
          <h2 className="font-bold text-lg">משהו השתבש בטעינת רכיב המניות.</h2>
          <p className="mt-2 text-sm">זה מנע מהדף להיטען. בדוק את הקונסול של הדפדפן לקבלת פרטים טכניים.</p>
          <pre className="mt-2 text-xs whitespace-pre-wrap bg-red-100 p-2 rounded">
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Re-designed StocksManager Component ---
function StocksManager() {
  const [stocks, setStocks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isAddStockDialogOpen, setAddStockDialogOpen] = useState(false);
  
  // Form state
  const [ticker, setTicker] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [sourceAccountName, setSourceAccountName] = useState('ללא הורדה');

  const fetchData = async () => {
    if (!loading && !refreshing) setLoading(true); // Show loader only on initial load
    setError(null);
    try {
      const [stocksRes, accountsRes] = await Promise.all([
        api.get('/stocks'),
        api.get('/dashboard/summary')
      ]);
      setStocks(stocksRes.data || []);
      setAccounts(accountsRes.data?.accounts || []);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בטעינת הנתונים';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- API Handlers ---
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!ticker || !purchasePrice || !investedAmount) {
      return toast.error("יש למלא את כל השדות.");
    }
    try {
      await api.post('/stocks', {
        ticker,
        purchasePrice: parseFloat(purchasePrice),
        investedAmount: parseFloat(investedAmount),
        sourceAccountName,
      });
      toast.success(`מניית ${ticker} נוספה בהצלחה!`);
      setTicker('');
      setPurchasePrice('');
      setInvestedAmount('');
      setAddStockDialogOpen(false); // Close dialog on success
      await fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בהוספת מניה';
      toast.error(errorMsg);
    }
  };

  const handleDeleteStock = async (stockId) => {
    try {
      await api.delete(`/stocks/${stockId}`);
      toast.success('המניה נמחקה.');
      await fetchData();
    } catch (err) {
      toast.error('שגיאה במחיקת המניה.');
    }
  };

  const handleSellStock = async (stockId) => {
    try {
      const { data } = await api.post(`/stocks/${stockId}/sell`);
      toast.success(data.message);
      await fetchData();
    } catch(err) {
      const errorMsg = err.response?.data?.message || 'שגיאה במכירת המניה';
      toast.error(errorMsg);
    }
  };

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    toast.loading('מעדכן מחירים...', { id: 'refresh-toast' });
    try {
      await api.post('/stocks/refresh-prices');
      await fetchData(); // Refetch all data
      toast.success('המחירים עודכנו.', { id: 'refresh-toast' });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'שגיאה בעדכון מחירים';
      toast.error(errorMsg, { id: 'refresh-toast' });
    } finally {
      setRefreshing(false);
    }
  };

  // --- Memoized Calculations for Stats ---
  const portfolioStats = useMemo(() => {
    if (!Array.isArray(stocks) || stocks.length === 0) {
        return { totalValue: 0, totalInvested: 0, totalProfitLoss: 0, totalProfitLossPercent: 0 };
    }
    // Assuming the backend provides ILS values. If not, conversion logic is needed.
    const totalValue = stocks.reduce((acc, stock) => acc + (stock.currentValueILS || 0), 0);
    const totalInvested = stocks.reduce((acc, stock) => acc + (stock.investedAmountILS || 0), 0);
    const totalProfitLoss = totalValue - totalInvested;
    const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    return { totalValue, totalInvested, totalProfitLoss, totalProfitLossPercent };
  }, [stocks]);

  // --- Render Logic ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <LoaderCircle className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 py-10 bg-red-50 rounded-lg">{error}</div>;
  }

  const formatCurrency = (value, currency = 'ILS') => {
    return value.toLocaleString('he-IL', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">תיק ההשקעות שלי</h2>
          <p className="text-slate-500">סקירה כללית של ביצועי המניות שלך.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefreshPrices} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ml-2 ${refreshing ? 'animate-spin' : ''}`} />
            רענן מחירים
          </Button>
          <Dialog open={isAddStockDialogOpen} onOpenChange={setAddStockDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                  <PlusCircle className="h-4 w-4 ml-2" />
                  הוסף מניה חדשה
               </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>הוספת מניה חדשה</DialogTitle>
                <DialogDescription>
                  הזן את פרטי הרכישה כדי להוסיף מניה חדשה למעקב.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStock} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="ticker" className="text-right">Ticker</label>
                  <Input id="ticker" placeholder="e.g., AAPL" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} required className="col-span-3"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="purchasePrice" className="text-right">מחיר קנייה ($)</label>
                  <Input id="purchasePrice" type="number" placeholder="150.25" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required step="0.01" className="col-span-3"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="investedAmount" className="text-right">סכום השקעה ($)</label>
                  <Input id="investedAmount" type="number" placeholder="1000" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} required step="0.01" className="col-span-3"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label htmlFor="sourceAccount" className="text-right">מקור</label>
                    <Select onValueChange={setSourceAccountName} defaultValue="ללא הורדה">
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="מקור הכסף" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ללא הורדה">ללא הורדה</SelectItem>
                        {Array.isArray(accounts) && accounts.map(acc => <SelectItem key={acc._id} value={acc.name}>{acc.name}</SelectItem>)}
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">שווי תיק נוכחי</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(portfolioStats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">הערך הכולל של התיק בשקלים</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סך הכל השקעה</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(portfolioStats.totalInvested)}</div>
            <p className="text-xs text-muted-foreground">סך כל ההשקעה בשקלים</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">רווח/הפסד כולל</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolioStats.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(portfolioStats.totalProfitLoss)}
            </div>
            <p className="text-xs text-muted-foreground">רווח או הפסד לא ממומש</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">תשואה כוללת</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolioStats.totalProfitLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioStats.totalProfitLossPercent.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">תשואה באחוזים על ההשקעה</p>
          </CardContent>
        </Card>
      </div>

      {/* Stocks Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>המניות שלי</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[100px]">Ticker</TableHead>
                  <TableHead className="text-right">שווי נוכחי (₪)</TableHead>
                  <TableHead className="text-right">רווח/הפסד ($)</TableHead>
                  <TableHead className="text-right">יחידות</TableHead>
                  <TableHead className="text-right">מחיר נוכחי ($)</TableHead>
                  <TableHead className="text-right">מחיר קנייה ($)</TableHead>
                  <TableHead>עדכון אחרון</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan="8" className="h-24 text-center text-slate-500">
                      עדיין לא הוספת מניות. לחץ על 'הוסף מניה חדשה' כדי להתחיל.
                    </TableCell>
                  </TableRow>
                ) : (
                  stocks.map(stock => {
                    const profit = stock.profitUSD || 0;
                    const isProfit = profit >= 0;
                    const updatedDate = stock.lastUpdated ? new Date(stock.lastUpdated) : null;
                    return (
                      <TableRow key={stock._id} className="hover:bg-slate-50/50">
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
                        <TableCell className="text-right font-semibold">{formatCurrency(stock.currentValueILS || 0)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={isProfit ? "success" : "destructive"}>
                            {isProfit ? <ArrowUpRight className="h-3 w-3 mr-1"/> : <ArrowDownRight className="h-3 w-3 mr-1"/>}
                            {formatCurrency(profit, 'USD')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{(stock.shares || 0).toFixed(4)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(stock.currentPrice || 0, 'USD')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(stock.purchasePrice || 0, 'USD')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {updatedDate && !isNaN(updatedDate) ? updatedDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">פתח תפריט</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleSellStock(stock._id)}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                <span>מכור הכל</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDeleteStock(stock._id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                <span>מחק לצמיתות</span>
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
    </div>
  );
}

// --- Main InvestmentsPage Component ---
// This wrapper component is updated with a more modern header.
export default function InvestmentsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
       <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">ניהול השקעות</h1>
        <p className="mt-2 text-lg text-slate-600">
          מעקב וניהול אינטראקטיבי אחר תיק המניות שלך.
        </p>
      </header>
      <main>
        <StocksErrorBoundary>
          <StocksManager />
        </StocksErrorBoundary>
      </main>
    </div>
  );
}