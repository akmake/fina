import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '@/utils/api';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';

// --- ייבוא רכיבי UI ---
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/Input";
import { PlusCircle, UploadCloud, CheckCircle, AlertTriangle, LoaderCircle, ArrowUpRight, ArrowDownLeft, Scale, ShoppingCart, Utensils, Car, Home, Receipt } from 'lucide-react';

// --- הגדרות קבועות ---
const CREATE_NEW_CATEGORY_VALUE = "CREATE_NEW";

// --- פונקציית עזר לקבלת אייקון לפי קטגוריה ---
const getCategoryIcon = (categoryName) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('סופר') || name.includes('מזון')) return <ShoppingCart className="h-5 w-5 text-white" />;
    if (name.includes('מסעדה') || name.includes('אוכל')) return <Utensils className="h-5 w-5 text-white" />;
    if (name.includes('רכב') || name.includes('דלק')) return <Car className="h-5 w-5 text-white" />;
    if (name.includes('בית') || name.includes('שכירות')) return <Home className="h-5 w-5 text-white" />;
    return <Receipt className="h-5 w-5 text-white" />;
};

// --- רכיב עזר לכרטיס עסקה ---
const TransactionCard = ({ transaction, onClick }) => {
    const isExpense = transaction.type === 'הוצאה';
    const amountColor = isExpense ? 'text-red-500' : 'text-green-600';
    const sign = isExpense ? '−' : '+';
    const categoryColor = `bg-slate-500`;

    return (
        <button onClick={onClick} className="w-full text-right flex items-center justify-between p-3 transition-all duration-200 hover:bg-slate-100 rounded-lg cursor-pointer">
            <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center h-10 w-10 rounded-full ${categoryColor}`}>
                    {getCategoryIcon(transaction.category)}
                </div>
                <div>
                    <p className="font-semibold text-slate-800">{transaction.description}</p>
                    <p className="text-sm text-slate-500">{format(new Date(transaction.date), 'dd/MM/yyyy')} • {transaction.category}</p>
                </div>
            </div>
            <p className={`font-mono font-semibold text-lg ${amountColor}`}>{sign} ₪{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </button>
    );
};

// --- רכיב עזר לסיכום חודשי ---
const MonthlySummaryCard = ({ transactions }) => {
    const summary = useMemo(() => {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);

        const relevantTransactions = transactions.filter(t => isWithinInterval(new Date(t.date), { start, end }));

        return relevantTransactions.reduce((acc, curr) => {
            if (curr.type === 'הכנסה') {
                acc.income += curr.amount;
            } else {
                acc.expense += curr.amount;
            }
            return acc;
        }, { income: 0, expense: 0 });
    }, [transactions]);

    const net = summary.income - summary.expense;

    return (
        <Card>
            <CardHeader>
                <CardTitle>סיכום ל{format(new Date(), 'MMMM yyyy', { locale: he })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-semibold text-green-800 flex items-center gap-2"><ArrowUpRight className="h-4 w-4" /> סך הכנסות</span>
                    <span className="font-bold text-green-600 text-lg">₪{summary.income.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="font-semibold text-red-800 flex items-center gap-2"><ArrowDownLeft className="h-4 w-4" /> סך הוצאות</span>
                    <span className="font-bold text-red-500 text-lg">₪{summary.expense.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg border-t-2">
                    <span className="font-semibold text-slate-800 flex items-center gap-2"><Scale className="h-4 w-4" /> מאזן</span>
                    <span className={`font-bold text-lg ${net >= 0 ? 'text-slate-800' : 'text-red-600'}`}>₪{net.toLocaleString()}</span>
                </div>
            </CardContent>
        </Card>
    );
};

// --- רכיב עזר לחלון פירוט עסק ---
const MerchantDetailDialog = ({ isOpen, onClose, transactions, merchantName }) => {
    const details = useMemo(() => {
        if (!merchantName) return { transactions: [], total: 0 };
        const merchantTransactions = transactions.filter(t => t.description === merchantName);
        const total = merchantTransactions.reduce((sum, t) => sum + t.amount, 0);
        return { transactions: merchantTransactions.sort((a,b) => new Date(b.date) - new Date(a.date)), total };
    }, [transactions, merchantName]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{merchantName}</DialogTitle>
                    <DialogDescription>
                        נמצאו {details.transactions.length} עסקאות. סך כל ההוצאות: <span className="font-bold text-red-500">₪{details.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="my-4 max-h-[60vh] overflow-y-auto pr-2 space-y-1">
                    {details.transactions.map(trx => (
                        <div key={trx._id} className="flex justify-between items-center p-2 rounded-md hover:bg-slate-50">
                            <div>
                                <p className="font-medium">{format(new Date(trx.date), 'dd MMMM yyyy', { locale: he })}</p>
                                <p className="text-sm text-slate-500">{trx.category}</p>
                            </div>
                            <p className="font-mono text-red-500">₪{trx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button onClick={onClose}>סגור</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// --- רכיב הדף הראשי ---
export default function FinanceDashboardPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), type: 'הוצאה', category: '', account: 'checking' });
    const [categories, setCategories] = useState([]);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    const [selectedMerchant, setSelectedMerchant] = useState(null);
    const [isMerchantDetailOpen, setIsMerchantDetailOpen] = useState(false);

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
        } catch (err) {
            console.error("Failed to fetch transactions", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data);
        } catch (err) {
            console.error("Could not fetch categories", err);
        }
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

            if (contextMerchant) {
                handleMappingChange(contextMerchant, 'category', newCategory._id);
            } else {
                setForm(prev => ({ ...prev, category: newCategory._id }));
            }

            setIsCategoryDialogOpen(false);
            setNewCategoryName('');
            setCurrentMerchantForNewCategory(null);
        } catch (err) {
            alert(`שגיאה ביצירת קטגוריה: ${err.response?.data?.message || err.message}`);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!form.category) { alert("נא לבחור קטגוריה."); return; }
        try {
            const categoryName = categories.find(c => c._id === form.category)?.name || 'כללי';
            const payload = { ...form, category: categoryName };
            await api.post('/transactions', payload);
            fetchTransactions();
            setForm({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), type: 'הוצאה', category: '', account: 'checking' });
        } catch (error) {
            alert('שגיאה בהוספת העסקה');
        }
    };
    
    const resetImportProcess = () => {
        setImportState('idle');
        setImporterType('');
        setParsedTransactions([]);
        setUnseenMerchants([]);
        setMappings({});
        setImportMessage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImportButtonClick = (type) => {
        resetImportProcess();
        setImporterType(type);
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event) => {
        const file = event.target.files?.[0];
        if (file) analyzeFile(file, importerType);
    };
    
    const analyzeFile = (file, type) => {
        setImportState('processing');
        setImportMessage('קורא ומנתח את קובץ האקסל...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

                const { data: response } = await api.post('/import/upload', { data: rawData, fileType: type });
                setParsedTransactions(response.transactions);

                if (response.unseenMerchants && response.unseenMerchants.length > 0) {
                    setUnseenMerchants(response.unseenMerchants);
                    const initialMappings = {};
                    response.unseenMerchants.forEach(name => {
                        initialMappings[name] = { newName: name, category: '' };
                    });
                    setMappings(initialMappings);
                    setImportState('mapping');
                } else {
                    setImportState('confirming');
                }
            } catch (error) {
                setImportMessage(error.response?.data?.message || error.message || 'שגיאה בקריאת הקובץ.');
                setImportState('error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleMappingChange = (originalName, field, value) => {
        if (field === 'category' && value === CREATE_NEW_CATEGORY_VALUE) {
            setCurrentMerchantForNewCategory(originalName);
            setIsCategoryDialogOpen(true);
        } else {
            setMappings(prev => ({ ...prev, [originalName]: { ...prev[originalName], [field]: value } }));
        }
    };
    
    const handleConfirmImport = async () => {
        setImportState('processing');
        setImportMessage('מעבד עסקאות ושומר במסד הנתונים...');

        const newMappings = Object.entries(mappings)
            .map(([originalName, values]) => ({
                originalName,
                newName: values.newName.trim() || originalName,
                category: values.category || null,
            }))
            .filter(m => m.newName !== m.originalName || m.category);

        const finalTransactions = parsedTransactions.map(trx => {
            const userMapping = mappings[trx.description];
            if (userMapping) {
                const newDescription = userMapping.newName.trim() || trx.description;
                const newCategory = categories.find(c => c._id === userMapping.category)?.name;
                return {
                    ...trx,
                    description: newDescription,
                    ...(newCategory && { category: newCategory }),
                };
            }
            return trx;
        });

        try {
            const { data: response } = await api.post('/import/process-transactions', {
                transactions: finalTransactions,
                newMappings,
            });
            setImportMessage(response.message);
            setImportState('finished');
            fetchTransactions();
        } catch (error) {
            setImportMessage(error.response?.data?.message || 'שגיאה קריטית בעיבוד הקובץ.');
            setImportState('error');
        }
    };

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
        <>
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 bg-slate-50 min-h-screen p-4 sm:p-8">
                <aside className="lg:col-span-2">
                    <div className="sticky top-8 space-y-8">
                        <MonthlySummaryCard transactions={transactions} />
                    </div>
                </aside>

                <main className="lg:col-span-5">
                    <Card>
                        <CardHeader>
                            <CardTitle>סקירת עסקאות</CardTitle>
                            <CardDescription>סה"כ {transactions.length} עסקאות</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? <p className="text-center p-8">טוען עסקאות...</p> : (
                                <div className="space-y-4">
                                    {Object.entries(groupedTransactions).map(([month, trans]) => (
                                        <div key={month}>
                                            <h3 className="font-semibold text-slate-600 my-3 px-3 capitalize">{month}</h3>
                                            <div className="space-y-1">
                                                {trans.map(t => <TransactionCard key={t._id} transaction={t} onClick={() => handleTransactionClick(t.description)} />)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>

                <aside className="lg:col-span-3">
                    <div className="sticky top-8 space-y-8">
                        <Card>
                            <CardHeader><CardTitle>הוסף עסקה חדשה</CardTitle></CardHeader>
                            <CardContent>
                                <form onSubmit={handleFormSubmit} className="space-y-4">
                                    <Input type="text" name="description" placeholder="תיאור העסקה" value={form.description} onChange={(e) => handleFormChange('description', e.target.value)} required />
                                    <Select value={form.category} onValueChange={handleCategoryChange}><SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                                        <SelectContent>{categories.filter(c => c.type === form.type || c.type === 'כללי').map(cat => (<SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>))}<SelectItem value={CREATE_NEW_CATEGORY_VALUE}>--- הוסף קטגוריה חדשה ---</SelectItem></SelectContent>
                                    </Select>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input type="number" name="amount" placeholder="סכום" value={form.amount} onChange={(e) => handleFormChange('amount', e.target.value)} required />
                                        <Input type="date" name="date" value={form.date} onChange={(e) => handleFormChange('date', e.target.value)} required />
                                    </div>
                                    <Select value={form.type} onValueChange={(v) => handleFormChange('type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="הוצאה">הוצאה</SelectItem><SelectItem value="הכנסה">הכנסה</SelectItem></SelectContent></Select>
                                    <Select value={form.account} onValueChange={(v) => handleFormChange('account', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="checking">עו"ש</SelectItem><SelectItem value="cash">מזומן</SelectItem><SelectItem value="deposits">פקדונות</SelectItem><SelectItem value="stocks">מניות וקרנות</SelectItem></SelectContent></Select>
                                    <Button type="submit" className="w-full"><PlusCircle className="ml-2 h-4 w-4" />הוסף עסקה</Button>
                                </form>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>ייבוא דפי חשבון</CardTitle></CardHeader>
                            <CardContent className="flex justify-center gap-4">
                                <Button variant="outline" type="button" onClick={() => handleImportButtonClick('max')}><UploadCloud className="ml-2 h-4 w-4"/>ייבוא "מקס"</Button>
                                <Button variant="outline" type="button" onClick={() => handleImportButtonClick('cal')}><UploadCloud className="ml-2 h-4 w-4"/>ייבוא "כאל"</Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".xlsx, .xls, .csv" className="hidden" />
                            </CardContent>
                        </Card>
                    </div>
                </aside>
            </div>

            <MerchantDetailDialog 
                isOpen={isMerchantDetailOpen} 
                onClose={() => setIsMerchantDetailOpen(false)}
                transactions={transactions}
                merchantName={selectedMerchant}
            />

            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>הוספת קטגוריה חדשה</DialogTitle></DialogHeader>
                    <div className="py-4"><Input placeholder="שם הקטגוריה..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /></div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsCategoryDialogOpen(false)}>ביטול</Button>
                        <Button type="button" onClick={() => handleSaveNewCategory(currentMerchantForNewCategory)}>שמור קטגוריה</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={importState !== 'idle'} onOpenChange={resetImportProcess}>
                <DialogContent className="max-w-3xl">
                    {importState === 'mapping' && (
                        <div>
                            <DialogHeader><DialogTitle>מיפוי ספקים חדשים</DialogTitle><DialogDescription>נמצאו {unseenMerchants.length} ספקים שדורשים מיפוי. ניתן למפות חלקית ולהמשיך.</DialogDescription></DialogHeader>
                            <div className="space-y-3 max-h-[50vh] overflow-y-auto my-6 pr-2">
                                {unseenMerchants.map(name => (
                                    <div key={name} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-2 rounded-md hover:bg-slate-50">
                                        <span className="truncate font-medium" title={name}>{name}</span>
                                        <Input placeholder="שם נקי (אופציונלי)" value={mappings[name]?.newName || ''} onChange={(e) => handleMappingChange(name, 'newName', e.target.value)} />
                                        <Select value={mappings[name]?.category || ''} onValueChange={(v) => handleMappingChange(name, 'category', v)}>
                                            <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map(cat => <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>)}
                                                <SelectItem value={CREATE_NEW_CATEGORY_VALUE}>--- צור קטגוריה חדשה ---</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={resetImportProcess}>ביטול</Button>
                                <Button type="button" onClick={handleConfirmImport}>המשך וייבא</Button>
                            </DialogFooter>
                        </div>
                    )}
                    {importState === 'confirming' && (
                        <div>
                            <DialogHeader><DialogTitle>אישור ייבוא</DialogTitle><DialogDescription>נמצאו {parsedTransactions.length} עסקאות מוכנות לייבוא. עסקאות קיימות לא יימחקו.</DialogDescription></DialogHeader>
                            <div className="my-4 max-h-[40vh] overflow-auto border rounded-md divide-y">
                                {parsedTransactions.slice(0, 100).map((trx, i) => <div key={i} className="flex justify-between p-2"><span className="font-medium">{trx.description}</span><span className="font-mono">{trx.amount}</span></div>)}
                                {parsedTransactions.length > 100 && <p className="p-4 text-center text-sm text-slate-500">ועוד {parsedTransactions.length - 100} עסקאות...</p>}
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={resetImportProcess}>ביטול</Button>
                                <Button onClick={handleConfirmImport}>אשר וייבא</Button>
                            </DialogFooter>
                        </div>
                    )}
                    {(importState === 'processing' || importState === 'finished' || importState === 'error') && (
                        <div className="text-center p-8 space-y-4">
                            {importState === 'processing' && <LoaderCircle className="mx-auto h-16 w-16 text-slate-400 animate-spin" />}
                            {importState === 'finished' && <CheckCircle className="mx-auto h-16 w-16 text-green-500" />}
                            {importState === 'error' && <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />}
                            <h2 className="text-2xl font-bold">{
                                { processing: 'בתהליך...', finished: 'הייבוא הושלם!', error: 'אופס, משהו השתבש' }[importState]
                            }</h2>
                            <p className={importState === 'error' ? 'text-red-600' : 'text-slate-600'}>{importMessage}</p>
                            {(importState === 'finished' || importState === 'error') && <Button onClick={resetImportProcess} className="mt-6">התחל ייבוא חדש</Button>}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}