import { useEffect, useState, useRef } from 'react';
import { useFundStore } from '@/stores/fundStore';
import { useAccountStore } from '@/stores/accountStore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { RefreshCw, Trash2, DollarSign, TrendingUp, TrendingDown, PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton'; // Assuming you have a skeleton component

// Helper component for individual fund cards
const FundCard = ({ fund, onSellClick, onDeleteClick }) => {
  const isProfit = fund.profit >= 0;
  const profitColor = isProfit ? 'text-green-600' : 'text-red-600';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl border shadow-sm p-4 flex flex-col justify-between"
    >
      <div>
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-gray-800">{fund.fund_number}</h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSellClick(fund)} aria-label="Sell">
              <DollarSign className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteClick(fund)} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">עודכן: {fund.last_updated ? new Date(fund.last_updated).toLocaleString('he-IL') : '—'}</p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
          <div><span className="text-gray-500">שווי נוכחי:</span><br/><span className="font-semibold text-lg">₪{fund.current_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
          <div className={`${profitColor}`}>
            <span className="text-gray-500">רווח/הפסד:</span><br/>
            <span className="font-semibold text-lg flex items-center">
              {isProfit ? <TrendingUp size={18} className="mr-1"/> : <TrendingDown size={18} className="mr-1"/>}
              ₪{fund.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div><span className="text-gray-500">השקעה:</span><br/><span className="font-mono">₪{fund.invested_amount.toLocaleString()}</span></div>
          <div><span className="text-gray-500">יחידות:</span><br/><span className="font-mono">{fund.units.toFixed(4)}</span></div>
          <div><span className="text-gray-500">מחיר קנייה:</span><br/><span className="font-mono">₪{fund.purchase_price.toFixed(4)}</span></div>
          <div><span className="text-gray-500">מחיר נוכחי:</span><br/><span className="font-mono">₪{fund.current_price.toFixed(4)}</span></div>
        </div>
      </div>
    </motion.div>
  );
};


// Main page component
export default function FundsPage() {
  const { funds, loading, fetchFunds, addFund, refreshPrices, deleteFund, sellFund } = useFundStore();
  const { accounts, fetchAccounts } = useAccountStore();

  const [fundToDelete, setFundToDelete] = useState(null);
  const [fundToSell, setFundToSell] = useState(null);
  
  const formRef = useRef(null);

  useEffect(() => {
    fetchFunds();
    fetchAccounts();
  }, [fetchFunds, fetchAccounts]);

  const handleAddFund = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (!data.fund_number || !data.purchase_price || !data.invested_amount) {
        toast.error("יש למלא את כל שדות החובה.");
        return;
    }

    addFund({
        fund_number: data.fund_number,
        purchase_price_agorot: data.purchase_price,
        invested_amount: parseFloat(data.invested_amount),
        sourceAccount: data.sourceAccount
    });
    
    formRef.current?.reset();
    formRef.current?.elements[0].focus();
  };

  const handleConfirmDelete = () => {
    if (fundToDelete) {
      deleteFund(fundToDelete._id);
      setFundToDelete(null);
    }
  };
  
  const handleConfirmSell = () => {
    if (fundToSell) {
      sellFund(fundToSell._id);
      setFundToSell(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 p-3 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">ניהול קרנות נאמנות</h1>
        <Button onClick={refreshPrices} disabled={loading} variant="outline">
          <RefreshCw className={`ml-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'מעדכן...' : 'עדכן מחירים'}
        </Button>
      </div>

      {/* Add Fund Form */}
      <Card className="shadow-lg border-blue-500/20">
         <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle size={22} /> הוספת קרן חדשה</CardTitle></CardHeader>
         <CardContent>
            <form ref={formRef} onSubmit={handleAddFund} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                <div>
                    <label htmlFor="fund_number" className="text-sm font-medium">מספר קרן</label>
                    <Input name="fund_number" id="fund_number" placeholder="לדוגמה: 5113617" required />
                </div>
                 <div>
                    <label htmlFor="purchase_price" className="text-sm font-medium">מחיר קנייה (באגורות)</label>
                    <Input name="purchase_price" id="purchase_price" type="number" step="0.01" placeholder="מחיר יחידה באגורות" required />
                </div>
                <div>
                    <label htmlFor="invested_amount" className="text-sm font-medium">סכום השקעה (₪)</label>
                    <Input name="invested_amount" id="invested_amount" type="number" step="0.01" placeholder="לדוגמה: 1000" required />
                </div>
                <div>
                    <label htmlFor="sourceAccount" className="text-sm font-medium">מקור הכסף</label>
                    <select name="sourceAccount" id="sourceAccount" className="w-full h-10 border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white">
                        <option value="ללא הורדה">ללא הורדה מחשבון</option>
                        {accounts.map(acc => <option key={acc._id} value={acc.name}>{acc.name}</option>)}
                    </select>
                </div>
               <Button type="submit" className="w-full sm:w-auto">הוסף קרן</Button>
            </form>
         </CardContent>
      </Card>
      
      {/* Funds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {loading && funds.length === 0 
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
                : funds.map((fund) => (
                    <FundCard key={fund._id} fund={fund} onSellClick={setFundToSell} onDeleteClick={setFundToDelete} />
                ))
            }
          </AnimatePresence>
      </div>
      
      {!loading && funds.length === 0 && (
          <div className="text-center py-16 text-gray-500">
              <h3 className="text-xl font-semibold">לא נמצאו קרנות.</h3>
              <p>הוסף קרן חדשה באמצעות הטופס למעלה כדי להתחיל.</p>
          </div>
      )}

      {/* Dialogs */}
      <Dialog open={!!fundToDelete} onOpenChange={() => setFundToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אישור מחיקה</DialogTitle>
            <DialogDescription>
              האם אתה בטוח שברצונך למחוק את הקרן {fundToDelete?.fund_number}? לא ניתן לשחזר פעולה זו.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>מחק</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!fundToSell} onOpenChange={() => setFundToSell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אישור מכירה</DialogTitle>
            <DialogDescription>
              פעולה זו תמכור את כל היחידות בקרן {fundToSell?.fund_number} לפי השווי הנוכחי של ₪{fundToSell?.current_value.toLocaleString()} ותפקיד את הסכום לחשבון העו"ש.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
            <Button variant="default" onClick={handleConfirmSell} className="bg-green-600 hover:bg-green-700">אשר מכירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}