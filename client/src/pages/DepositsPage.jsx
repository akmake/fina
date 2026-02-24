import { useState, useEffect, useMemo } from 'react';
import { useDepositsStore } from '../stores/depositsStore';
import { useAccountStore } from '../stores/accountStore';

// --- UI Components ---
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Switch } from '../components/ui/switch';

// --- Icons ---
import { Landmark, PiggyBank, Percent, CheckCircle, Hourglass, Milestone, Flag, TrendingUp, Clock } from 'lucide-react';

// --- Utils ---
import { format, formatDistanceToNowStrict, isPast, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';

// ============================================================================
// Helper Functions
// ============================================================================
function addMonths(baseDate, months) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + months);
    return d;
}

// ============================================================================
// Helper Component: SummaryStatsCard
// ============================================================================
const SummaryStatsCard = ({ deposits }) => {
    const stats = useMemo(() => {
        return deposits.reduce(
            (acc, dep) => {
                acc.totalPrincipal += dep.principal;
                acc.totalFutureValue += dep.futureValue || dep.principal;
                return acc;
            },
            { totalPrincipal: 0, totalFutureValue: 0 }
        );
    }, [deposits]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Landmark className="w-6 h-6 text-primary" />
                    <span>סיכום הפיקדונות</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">סך הקרן המושקעת</span>
                    <span className="font-bold text-lg">₪{stats.totalPrincipal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">שווי צפוי בסיום</span>
                    <span className="font-bold text-lg text-green-600">₪{stats.totalFutureValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">מספר פיקדונות</span>
                    <span className="font-bold text-lg">{deposits.length}</span>
                </div>
            </CardContent>
        </Card>
    );
};

// ============================================================================
// Helper Component: DepositCard
// ============================================================================
const DepositCard = ({ deposit, onBreak, onWithdraw }) => {
    const now = new Date();
    const startDate = new Date(deposit.startDate);
    const endDate = new Date(deposit.endDate);
    
    const isMatured = now >= endDate;
    const totalDurationInDays = differenceInDays(endDate, startDate);
    const elapsedDays = differenceInDays(now, startDate);
    const progress = totalDurationInDays > 0 ? Math.min(100, (elapsedDays / totalDurationInDays) * 100) : (isMatured ? 100 : 0);
    
    const upcomingExitPoints = (deposit.exitPoints || [])
        .map(p => new Date(p))
        .filter(p => !isPast(p))
        .sort((a, b) => a - b);
        
    const nextExitPoint = upcomingExitPoints.length > 0 ? upcomingExitPoints[0] : null;
    
    let nextExitPointProgress = null;
    if (nextExitPoint && totalDurationInDays > 0) {
        const daysToNextExit = differenceInDays(nextExitPoint, startDate);
        nextExitPointProgress = (daysToNextExit / totalDurationInDays) * 100;
    }

    return (
        <Card className="flex flex-col h-full transition-all hover:shadow-lg border-2 border-transparent hover:border-primary/50">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{deposit.name}</CardTitle>
                        <CardDescription>
                            {isMatured ? 
                                <Badge variant="success" className="mt-1"><CheckCircle className="w-3 h-3 mr-1"/>הפיקדון נזיל</Badge> : 
                                <Badge variant="secondary" className="mt-1"><Clock className="w-3 h-3 mr-1"/>בתוקף</Badge>
                            }
                        </CardDescription>
                    </div>
                     <div className="text-right">
                        <p className="text-sm text-muted-foreground flex items-center justify-end gap-1"><TrendingUp className="w-4 h-4"/> שווי צפוי בסיום</p>
                        <p className="text-xl font-bold text-green-600">
                           ₪{deposit.futureValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <TooltipProvider>
                    <div className="space-y-2">
                        <div className="relative w-full">
                            <Progress value={progress} className="h-2" />
                            {nextExitPointProgress && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="absolute top-1/2 -translate-y-1/2 h-4 w-2 bg-primary rounded-full cursor-pointer z-10" 
                                             style={{ left: `${nextExitPointProgress}%` }}
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-primary text-primary-foreground">
                                        <p>תחנת יציאה קרובה: {format(nextExitPoint, 'dd/MM/yyyy')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{format(startDate, 'dd/MM/yy')}</span>
                            <span>{format(endDate, 'dd/MM/yy')}</span>
                        </div>
                    </div>
                </TooltipProvider>

                {nextExitPoint && (
                     <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-center">
                        <p className="text-sm font-semibold text-primary flex items-center justify-center gap-1.5">
                            <Flag className="w-4 h-4"/>
                            תחנת יציאה קרובה
                        </p>
                        <p className="text-lg font-bold text-foreground mt-1">{format(nextExitPoint, 'dd MMMM yyyy', { locale: he })}</p>
                        <p className="text-sm text-muted-foreground">
                            (בעוד {formatDistanceToNowStrict(nextExitPoint, { locale: he, addSuffix: false })})
                        </p>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-2 text-sm border-t">
                    <div className="flex items-center gap-2">
                        <PiggyBank className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-muted-foreground">סכום התחלתי</p>
                            <p className="font-semibold">₪{deposit.principal.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <Percent className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-muted-foreground">ריבית שנתית</p>
                            <p className="font-semibold">{deposit.annualInterestRate.toFixed(2)}%</p>
                        </div>
                    </div>
                </div>

            </CardContent>
            <CardFooter className="flex justify-end gap-2 bg-muted/50 p-3">
                <Button variant="destructive-outline" size="sm" onClick={() => onBreak(deposit._id)} disabled={isMatured}>
                    <Hourglass className="w-4 h-4 mr-2" />
                    שבור פיקדון
                </Button>
                <Button variant="primary" size="sm" onClick={() => onWithdraw(deposit._id)} disabled={!isMatured}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    משוך סכום
                </Button>
            </CardFooter>
        </Card>
    );
};


// ============================================================================
// Main Page Component
// ============================================================================
export default function DepositsPage() {
    const { deposits, loading, error, fetchDeposits, addDeposit, breakDeposit, withdrawDeposit } = useDepositsStore();
    const { accounts, fetchAccounts } = useAccountStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const initialFormData = {
        name: '',
        principal: '',
        annualInterestRate: '',
        durationValue: '1',
        durationUnit: 'חודשים',
        startDate: new Date().toISOString().split('T')[0],
        sourceAccount: 'ללא הורדה מחשבון',
        hasPeriodicExitPoints: false,
        exitPointInterval: '3',
        exitPointUnit: 'חודשים'
    };
    const [formData, setFormData] = useState(initialFormData);
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchDeposits();
        fetchAccounts();
    }, [fetchDeposits, fetchAccounts]);

    useEffect(() => {
        const { startDate, durationValue, durationUnit } = formData;
        if (startDate && durationValue > 0) {
            const months = durationUnit === 'שנים' ? parseInt(durationValue, 10) * 12 : parseInt(durationValue, 10);
            const calculatedEndDate = addMonths(new Date(startDate), months);
            setEndDate(calculatedEndDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }));
        }
    }, [formData.startDate, formData.durationValue, formData.durationUnit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    };

    const handleSelectChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
    };

    const handleSwitchChange = (name, checked) => {
        setFormData({ ...formData, [name]: checked });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        let calculatedExitPoints = [];
        if (formData.hasPeriodicExitPoints) {
            const interval = parseInt(formData.exitPointInterval, 10);
            const durationMonths = formData.durationUnit === 'שנים' ? parseInt(formData.durationValue, 10) * 12 : parseInt(formData.durationValue, 10);
            
            if (interval > 0) {
                const finalEndDate = addMonths(new Date(formData.startDate), durationMonths);
                let currentDate = new Date(formData.startDate);

                while (true) {
                    const monthsToAdd = formData.exitPointUnit === 'שנים' ? interval * 12 : interval;
                    currentDate = addMonths(currentDate, monthsToAdd);
                    
                    if (currentDate < finalEndDate) {
                        calculatedExitPoints.push(currentDate.toISOString());
                    } else {
                        break;
                    }
                }
            }
        }

        const finalFormData = {
            ...formData,
            exitPoints: calculatedExitPoints,
        };

        const success = await addDeposit(finalFormData);
        if (success) {
            setFormData(initialFormData);
        }
        setIsSubmitting(false);
    };

    const handleBreak = (id) => {
        if (window.confirm('האם אתה בטוח שברצונך לשבור את הפיקדון? הקרן תועבר לחשבון העו"ש.')) {
            breakDeposit(id);
        }
    };

    const handleWithdraw = (id) => {
        if (window.confirm('האם למשוך את הפיקדון? הסכום המלא (קרן + ריבית) יועבר לחשבון העו"ש.')) {
            withdrawDeposit(id);
        }
    };

    return (
        <div className="container mx-auto p-3 sm:p-4 md:p-6 lg:p-8 bg-muted/20 min-h-screen">


            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
                
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-2xl font-bold text-foreground">הפיקדונות שלי</h2>
                    {loading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
                        </div>
                    )}
                    {error && <p className="text-center text-red-600 bg-red-100 p-4 rounded-lg">{error}</p>}
                    {!loading && !error && (
                        deposits.length === 0 ? (
                            <div className="text-center py-16 bg-background rounded-lg border border-dashed">
                                <PiggyBank className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-2 text-xl font-semibold">עדיין אין פיקדונות</h3>
                                <p className="mt-1 text-muted-foreground">התחל לחסוך! הוסף את הפיקדון הראשון שלך.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {deposits.map((dep) => (
                                    <DepositCard key={dep._id} deposit={dep} onBreak={handleBreak} onWithdraw={handleWithdraw} />
                                ))}
                            </div>
                        )
                    )}
                </div>

                <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
                    {!loading && <SummaryStatsCard deposits={deposits} />}

                    <Card>
                        <CardHeader>
                            <CardTitle>הוספת פיקדון חדש</CardTitle>
                            <CardDescription>מלא את הפרטים כדי להוסיף פיקדון למעקב.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="name">שם הפיקדון</Label>
                                    <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="לדוגמה: פיקדון ריבית פרימיום" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="principal">סכום (₪)</Label>
                                        <Input id="principal" name="principal" type="number" value={formData.principal} onChange={handleChange} placeholder="10,000" required min="0.01" step="0.01" />
                                    </div>
                                    <div>
                                        <Label htmlFor="annualInterestRate">ריבית (%)</Label>
                                        <Input id="annualInterestRate" name="annualInterestRate" type="number" value={formData.annualInterestRate} onChange={handleChange} placeholder="5.2" required min="0" step="0.01" />
                                    </div>
                                </div>
                                
                                <Label>משך הפיקדון</Label>
                                <div className="flex gap-2">
                                    <Input id="durationValue" name="durationValue" type="number" value={formData.durationValue} onChange={handleChange} required min="1" className="w-1/2" />
                                    <Select name="durationUnit" value={formData.durationUnit} onValueChange={(value) => handleSelectChange('durationUnit', value)}>
                                        <SelectTrigger className="w-1/2"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="חודשים">חודשים</SelectItem>
                                            <SelectItem value="שנים">שנים</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="startDate">תאריך פתיחה</Label>
                                        <Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} required />
                                    </div>
                                    <div>
                                        <Label>תאריך סיום</Label>
                                        <Input value={endDate} disabled className="bg-muted font-mono text-center" />
                                    </div>
                                </div>
                                
                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="hasPeriodicExitPoints" className="font-semibold">תחנות יציאה תקופתיות</Label>
                                        <Switch
                                            id="hasPeriodicExitPoints"
                                            checked={formData.hasPeriodicExitPoints}
                                            onCheckedChange={(checked) => handleSwitchChange('hasPeriodicExitPoints', checked)}
                                        />
                                    </div>
                                    {formData.hasPeriodicExitPoints && (
                                        <div className="p-3 bg-muted rounded-md">
                                            <Label>יצירת תחנת יציאה כל:</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input 
                                                    type="number"
                                                    name="exitPointInterval"
                                                    value={formData.exitPointInterval}
                                                    onChange={handleChange}
                                                    min="1"
                                                    className="w-1/2"
                                                />
                                                <Select
                                                    name="exitPointUnit"
                                                    value={formData.exitPointUnit}
                                                    onValueChange={(value) => handleSelectChange('exitPointUnit', value)}
                                                >
                                                    <SelectTrigger className="w-1/2"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="חודשים">חודשים</SelectItem>
                                                        <SelectItem value="שנים">שנים</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <Label htmlFor="sourceAccount">מקור הכסף (אופציונלי)</Label>
                                    <Select name="sourceAccount" value={formData.sourceAccount} onValueChange={(value) => handleSelectChange('sourceAccount', value)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ללא הורדה מחשבון">ללא הורדה מחשבון</SelectItem>
                                            {accounts.map(acc => <SelectItem key={acc.name} value={acc.name}>{acc.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? 'מוסיף...' : 'הוסף פיקדון'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </aside>
            </main>
        </div>
    );
}