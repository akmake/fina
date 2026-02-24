import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '@/utils/api';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';

// --- אייקונים ---
import { 
    Plus, Upload, Check, AlertCircle, Loader2, 
    ArrowUpRight, ArrowDownLeft, Wallet, CreditCard,
    Calendar, Search, Filter, Briefcase, ShoppingBag, 
    Coffee, Home, Car, Zap, MoreHorizontal
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/badge";

const CREATE_NEW_CATEGORY_VALUE = "CREATE_NEW";

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

// --- אייקון קטגוריה חכם ---
const CategoryIcon = ({ category }) => {
    const c = category?.toLowerCase() || '';
    let Icon = ShoppingBag;
    let colorClass = "bg-slate-100 text-slate-500";

    if (c.includes('אוכל') || c.includes('מסעדה') || c.includes('מזון')) { Icon = Coffee; colorClass = "bg-orange-100 text-orange-600"; }
    else if (c.includes('בית') || c.includes('שכירות') || c.includes('עיצוב')) { Icon = Home; colorClass = "bg-indigo-100 text-indigo-600"; }
    else if (c.includes('רכב') || c.includes('דלק') || c.includes('תחבורה')) { Icon = Car; colorClass = "bg-blue-100 text-blue-600"; }
    else if (c.includes('חשמל') || c.includes('תקשורת') || c.includes('מחשב')) { Icon = Zap; colorClass = "bg-yellow-100 text-yellow-600"; }
    else if (c.includes('עבודה') || c.includes('משכורת')) { Icon = Briefcase; colorClass = "bg-emerald-100 text-emerald-600"; }

    return (
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${colorClass} shadow-sm transition-transform group-hover:scale-105`}>
            <Icon className="h-5 w-5" strokeWidth={2.5} />
        </div>
    );
};

// --- כרטיס עסקה בסגנון Apple Wallet ---
const TransactionCard = ({ transaction, onClick }) => {
    const isExpense = transaction.type === 'הוצאה';
    const amountClass = isExpense ? 'text-slate-900' : 'text-emerald-600';
    const sign = isExpense ? '' : '+';

    return (
        <div 
            onClick={onClick}
            className="group relative bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/40 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer flex items-center justify-between mb-3"
        >
            <div className="flex items-center gap-4">
                <CategoryIcon category={transaction.category} />
                <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-[15px] tracking-tight group-hover:text-blue-600 transition-colors">
                        {transaction.description}
                    </span>
                    <span className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-2">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md">{transaction.category}</span>
                        <span>{format(new Date(transaction.date), 'd בMMM', { locale: he })}</span>
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-end">
                <span className={`text-[16px] font-bold tracking-tight ${amountClass}`}>
                    {sign}{formatCurrency(transaction.amount)}
                </span>
            </div>
        </div>
    );
};

// --- כרטיס KPI ---
const KpiCard = ({ title, value, icon: Icon, trend }) => (
    <div className="bg-white/60 backdrop-blur-xl p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-white/50 shadow-sm flex flex-col justify-between h-28 sm:h-36 relative overflow-hidden group hover:bg-white/80 transition-all">
        <div className="flex justify-between items-start z-10">
            <span className="text-sm font-semibold text-slate-500">{title}</span>
            <div className="p-2 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                <Icon className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
        </div>
        <div className="z-10">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(value)}</h3>
            {trend && <p className="text-xs text-slate-400 mt-1 font-medium">{trend}</p>}
        </div>
    </div>
);

export default function FinanceDashboardPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), type: 'הוצאה', category: '', account: 'checking' });
    const [categories, setCategories] = useState([]);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    const [selectedMerchant, setSelectedMerchant] = useState(null);
    const [isMerchantDetailOpen, setIsMerchantDetailOpen] = useState(false);

    // ייבוא
    const [importState, setImportState] = useState('idle');
    const [importerType, setImporterType] = useState('');
    const [parsedTransactions, setParsedTransactions] = useState([]);
    const [unseenMerchants, setUnseenMerchants] = useState([]);
    const [mappings, setMappings] = useState({});
    const [importMessage, setImportMessage] = useState('');
    const [currentMerchantForNewCategory, setCurrentMerchantForNewCategory] = useState(null);
    const fileInputRef = useRef(null);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const response = await api.get('/transactions');
            setTransactions(response.data);
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchTransactions();
        fetchCategories();
    }, []);

    const handleTransactionClick = (merchantName) => {
        setSelectedMerchant(merchantName);
        setIsMerchantDetailOpen(true);
    };

    const handleFormChange = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
    const handleCategoryChange = (value) => {
        if (value === CREATE_NEW_CATEGORY_VALUE) setIsCategoryDialogOpen(true);
        else setForm(prev => ({ ...prev, category: value }));
    };

    const handleSaveNewCategory = async (contextMerchant = null) => {
        if (!newCategoryName.trim()) return;
        try {
            const { data: newCategory } = await api.post('/categories', { name: newCategoryName.trim(), type: 'הוצאה' });
            const updatedCategories = [...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name));
            setCategories(updatedCategories);
            if (contextMerchant) handleMappingChange(contextMerchant, 'category', newCategory._id);
            else setForm(prev => ({ ...prev, category: newCategory._id }));
            setIsCategoryDialogOpen(false);
            setNewCategoryName('');
            setCurrentMerchantForNewCategory(null);
        } catch (err) { alert(`שגיאה: ${err.message}`); }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!form.category) { alert("נא לבחור קטגוריה."); return; }
        try {
            const categoryName = categories.find(c => c._id === form.category)?.name || 'כללי';
            await api.post('/transactions', { ...form, category: categoryName });
            fetchTransactions();
            setForm({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), type: 'הוצאה', category: '', account: 'checking' });
        } catch (error) { alert('שגיאה בהוספת העסקה'); }
    };
    
    // לוגיקת ייבוא
    const resetImportProcess = () => {
        setImportState('idle'); setImporterType(''); setParsedTransactions([]); setUnseenMerchants([]); setMappings({}); setImportMessage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    const handleImportButtonClick = (type) => { resetImportProcess(); setImporterType(type); fileInputRef.current?.click(); };
    const handleFileSelected = (event) => { const file = event.target.files?.[0]; if (file) analyzeFile(file, importerType); };
    
    const analyzeFile = (file, type) => {
        setImportState('processing'); setImportMessage('מנתח קובץ...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
                const { data: response } = await api.post('/import/upload', { data: rawData, fileType: type });
                setParsedTransactions(response.transactions);
                if (response.unseenMerchants?.length > 0) {
                    setUnseenMerchants(response.unseenMerchants);
                    const initialMappings = {};
                    response.unseenMerchants.forEach(name => initialMappings[name] = { newName: name, category: '' });
                    setMappings(initialMappings);
                    setImportState('mapping');
                } else setImportState('confirming');
            } catch (error) { setImportMessage(error.response?.data?.message || 'שגיאה בקובץ'); setImportState('error'); }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleMappingChange = (originalName, field, value) => {
        if (field === 'category' && value === CREATE_NEW_CATEGORY_VALUE) {
            setCurrentMerchantForNewCategory(originalName); setIsCategoryDialogOpen(true);
        } else setMappings(prev => ({ ...prev, [originalName]: { ...prev[originalName], [field]: value } }));
    };
    
    const handleConfirmImport = async () => {
        setImportState('processing'); setImportMessage('שומר נתונים...');
        const newMappings = Object.entries(mappings).map(([originalName, values]) => ({
            originalName, newName: values.newName.trim() || originalName, category: values.category || null,
        })).filter(m => m.newName !== m.originalName || m.category);

        const finalTransactions = parsedTransactions.map(trx => {
            const m = mappings[trx.description];
            if (m) {
                const newCat = categories.find(c => c._id === m.category)?.name;
                return { ...trx, description: m.newName.trim() || trx.description, ...(newCat && { category: newCat }) };
            }
            return trx;
        });

        try {
            await api.post('/import/process-transactions', { transactions: finalTransactions, newMappings });
            setImportMessage('הייבוא הושלם בהצלחה'); setImportState('finished'); fetchTransactions();
        } catch (error) { setImportMessage('שגיאה בשמירה'); setImportState('error'); }
    };

    const summary = useMemo(() => {
        const now = new Date();
        const relevant = transactions.filter(t => isWithinInterval(new Date(t.date), { start: startOfMonth(now), end: endOfMonth(now) }));
        return relevant.reduce((acc, curr) => {
            if (curr.type === 'הכנסה') acc.income += curr.amount; else acc.expense += curr.amount; return acc;
        }, { income: 0, expense: 0 });
    }, [transactions]);

    const groupedTransactions = useMemo(() => {
        const groups = {};
        transactions.forEach(t => {
            const month = format(new Date(t.date), 'LLLL yyyy', { locale: he });
            if (!groups[month]) groups[month] = [];
            groups[month].push(t);
        });
        return groups;
    }, [transactions]);
  
    return (
        <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-20">
            
            {/* Top Navigation */}
            <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/50 px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">הארנק שלי</h1>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="rounded-full h-9 sm:h-10 px-4 sm:px-6 bg-white/50 border-slate-200 text-slate-700 hover:bg-white hover:shadow-md transition-all flex-1 sm:flex-none text-sm" onClick={() => handleImportButtonClick('max')}>
                        <Upload className="ml-2 h-4 w-4" /> Max
                    </Button>
                    <Button variant="outline" className="rounded-full h-9 sm:h-10 px-4 sm:px-6 bg-white/50 border-slate-200 text-slate-700 hover:bg-white hover:shadow-md transition-all flex-1 sm:flex-none text-sm" onClick={() => handleImportButtonClick('cal')}>
                        <Upload className="ml-2 h-4 w-4" /> Cal
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".xlsx, .xls, .csv" className="hidden" />
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12">
                    <KpiCard title="יתרה חודשית" value={summary.income - summary.expense} icon={Wallet} trend="מאזן נוכחי" />
                    <KpiCard title="הכנסות" value={summary.income} icon={ArrowUpRight} trend="נכנס לחשבון" />
                    <KpiCard title="הוצאות" value={summary.expense} icon={ArrowDownLeft} trend="יצא מהחשבון" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
                    
                    {/* Main Feed */}
                    <main className="lg:col-span-8">
                        <div className="flex items-center justify-between mb-6 sm:mb-8">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900">פעילות אחרונה</h2>
                            <div className="flex gap-1 sm:gap-2 bg-white/60 p-1 rounded-full border border-white/50 shadow-sm">
                                <Badge variant="secondary" className="bg-white hover:bg-slate-50 text-slate-900 shadow-sm cursor-pointer px-2 sm:px-4 py-1 sm:py-1.5 rounded-full font-medium text-xs sm:text-sm">הכל</Badge>
                                <Badge variant="ghost" className="text-slate-500 hover:bg-white/50 cursor-pointer px-2 sm:px-4 py-1 sm:py-1.5 rounded-full font-medium text-xs sm:text-sm">הוצאות</Badge>
                                <Badge variant="ghost" className="text-slate-500 hover:bg-white/50 cursor-pointer px-2 sm:px-4 py-1 sm:py-1.5 rounded-full font-medium text-xs sm:text-sm">הכנסות</Badge>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
                        ) : (
                            Object.entries(groupedTransactions).map(([month, trans]) => (
                                <div key={month} className="mb-10">
                                    <div className="sticky top-20 z-20 backdrop-blur-md bg-[#F2F4F8]/80 py-2 mb-4 px-2">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{month}</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {trans.map(t => <TransactionCard key={t._id} transaction={t} onClick={() => handleTransactionClick(t.description)} />)}
                                    </div>
                                </div>
                            ))
                        )}
                    </main>

                    {/* Sidebar / Quick Actions */}
                    <aside className="lg:col-span-4 space-y-8">
                        {/* Add Transaction Widget */}
                        <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] shadow-sm border border-white/60 lg:sticky lg:top-28">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/20">
                                    <Plus className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl text-slate-900">פעולה חדשה</h3>
                                    <p className="text-sm text-slate-500">הוסף הוצאה או הכנסה</p>
                                </div>
                            </div>
                            <form onSubmit={handleFormSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 mr-2">תיאור</label>
                                    <Input className="h-14 bg-white border-transparent focus:border-slate-200 rounded-3xl shadow-sm text-lg px-6" placeholder="מה קנינו?" value={form.description} onChange={(e) => handleFormChange('description', e.target.value)} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 mr-2">סכום</label>
                                        <Input className="h-14 bg-white border-transparent focus:border-slate-200 rounded-3xl shadow-sm text-lg px-6 font-mono" type="number" placeholder="0.00" value={form.amount} onChange={(e) => handleFormChange('amount', e.target.value)} required />
                                    </div>
                                     <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 mr-2">תאריך</label>
                                        <Input className="h-14 bg-white border-transparent focus:border-slate-200 rounded-3xl shadow-sm px-4 text-sm" type="date" value={form.date} onChange={(e) => handleFormChange('date', e.target.value)} required />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 mr-2">קטגוריה</label>
                                    <Select value={form.category} onValueChange={handleCategoryChange}>
                                        <SelectTrigger className="h-14 bg-white border-transparent rounded-3xl shadow-sm px-6 text-slate-600"><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                                        <SelectContent className="rounded-3xl">
                                            {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                                            <SelectItem value={CREATE_NEW_CATEGORY_VALUE} className="text-blue-600 font-bold">+ קטגוריה חדשה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                     <Select value={form.type} onValueChange={(v) => handleFormChange('type', v)}>
                                        <SelectTrigger className="h-12 rounded-3xl border-transparent bg-slate-100 shadow-inner"><SelectValue/></SelectTrigger>
                                        <SelectContent className="rounded-2xl"><SelectItem value="הוצאה">הוצאה</SelectItem><SelectItem value="הכנסה">הכנסה</SelectItem></SelectContent>
                                    </Select>
                                    <Select value={form.account} onValueChange={(v) => handleFormChange('account', v)}>
                                        <SelectTrigger className="h-12 rounded-3xl border-transparent bg-slate-100 shadow-inner"><SelectValue/></SelectTrigger>
                                        <SelectContent className="rounded-2xl"><SelectItem value="checking">עו"ש</SelectItem><SelectItem value="cash">מזומן</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" className="w-full h-14 rounded-3xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg shadow-xl shadow-slate-900/10 mt-4 transition-transform active:scale-95">
                                    שמור
                                </Button>
                            </form>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Dialogs */}
            <Dialog open={isMerchantDetailOpen} onOpenChange={setIsMerchantDetailOpen}>
                <DialogContent className="rounded-[40px] p-0 overflow-hidden bg-white max-w-sm border-none shadow-2xl">
                    <div className="bg-slate-50 p-10 text-center">
                        <div className="mx-auto h-20 w-20 bg-white rounded-3xl flex items-center justify-center shadow-md mb-6 rotate-3">
                            <ShoppingBag className="h-10 w-10 text-slate-800" />
                        </div>
                        <DialogTitle className="text-2xl font-bold text-slate-900">{selectedMerchant}</DialogTitle>
                        <p className="text-slate-500 font-medium mt-2">היסטוריית עסקאות</p>
                    </div>
                    <div className="p-6 max-h-[40vh] overflow-y-auto">
                        {transactions.filter(t => t.description === selectedMerchant).map((trx, i) => (
                            <div key={i} className="flex justify-between items-center p-4 hover:bg-slate-50 rounded-3xl transition-colors mb-1">
                                <span className="text-sm font-medium text-slate-500">{format(new Date(trx.date), 'dd/MM/yy')}</span>
                                <span className="font-bold text-slate-900 font-mono text-lg">{formatCurrency(trx.amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t border-slate-100">
                        <Button variant="outline" className="w-full h-12 rounded-3xl border-slate-200 text-slate-700 font-bold" onClick={() => setIsMerchantDetailOpen(false)}>סגור</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent className="rounded-[32px] p-8 border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-2xl font-bold text-center">קטגוריה חדשה</DialogTitle></DialogHeader>
                    <div className="py-6"><Input className="h-14 rounded-3xl bg-slate-50 border-transparent text-center text-lg" placeholder="שם הקטגוריה..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /></div>
                    <DialogFooter><Button onClick={() => handleSaveNewCategory(currentMerchantForNewCategory)} className="w-full h-12 rounded-3xl bg-slate-900 font-bold">שמור קטגוריה</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={importState !== 'idle'} onOpenChange={resetImportProcess}>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl rounded-[28px] sm:rounded-[40px] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                            {importState === 'processing' && <Loader2 className="animate-spin text-blue-500" />}
                            {importState === 'mapping' && <Filter className="text-orange-500" />}
                            {importState === 'confirming' && <Check className="text-green-500" />}
                            {importState === 'error' && <AlertCircle className="text-red-500" />}
                        </div>
                        <div>
                             <DialogTitle className="text-2xl font-bold text-slate-900">{importState === 'mapping' ? 'נדרש מיפוי' : 'ייבוא קובץ'}</DialogTitle>
                             <DialogDescription className="text-slate-500 font-medium">{importMessage}</DialogDescription>
                        </div>
                    </div>
                    <div className="p-8 max-h-[50vh] overflow-y-auto bg-white">
                        {importState === 'mapping' && (
                            <div className="space-y-4">
                                {unseenMerchants.map(name => (
                                    <div key={name} className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-3xl">
                                        <span className="flex-1 font-bold text-slate-700 truncate w-full px-2">{name}</span>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Input className="h-12 rounded-2xl bg-white border-transparent shadow-sm" placeholder="שם נקי" value={mappings[name]?.newName || ''} onChange={(e) => handleMappingChange(name, 'newName', e.target.value)} />
                                            <Select value={mappings[name]?.category || ''} onValueChange={(v) => handleMappingChange(name, 'category', v)}>
                                                <SelectTrigger className="h-12 rounded-2xl bg-white border-transparent shadow-sm w-[160px]"><SelectValue placeholder="קטגוריה" /></SelectTrigger>
                                                <SelectContent className="rounded-2xl">{categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}<SelectItem value={CREATE_NEW_CATEGORY_VALUE}>+ חדשה</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {importState === 'confirming' && (
                            <div className="space-y-2">
                                {parsedTransactions.slice(0, 20).map((t, i) => (
                                    <div key={i} className="flex justify-between text-sm p-4 bg-slate-50 rounded-2xl"><span className="font-bold text-slate-700">{t.description}</span><span className="font-mono text-slate-900">{t.amount}</span></div>
                                ))}
                                {parsedTransactions.length > 20 && <p className="text-center text-xs text-slate-400 mt-4 font-medium">ועוד {parsedTransactions.length - 20} עסקאות...</p>}
                            </div>
                        )}
                        {['processing', 'finished', 'error'].includes(importState) && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                {importState === 'finished' && <h3 className="text-2xl font-bold text-green-600 mt-4">הצלחה!</h3>}
                                {importState === 'error' && <h3 className="text-2xl font-bold text-red-600 mt-4">שגיאה</h3>}
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
                        {['mapping', 'confirming'].includes(importState) ? (
                            <div className="flex gap-4 w-full">
                                <Button variant="ghost" onClick={resetImportProcess} className="flex-1 h-12 rounded-3xl font-bold text-slate-500">ביטול</Button>
                                <Button onClick={handleConfirmImport} className="flex-1 h-12 rounded-3xl bg-slate-900 font-bold text-white shadow-lg shadow-slate-900/20">המשך</Button>
                            </div>
                        ) : (
                            <Button onClick={resetImportProcess} className="w-full h-12 rounded-3xl bg-white border border-slate-200 font-bold text-slate-900 shadow-sm">סגור</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}