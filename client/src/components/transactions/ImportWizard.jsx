import { Check, AlertCircle, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CREATE_NEW_CATEGORY_VALUE } from './utils';

export default function ImportWizard({
  importState,
  importMessage,
  unseenMerchants,
  mappings,
  parsedTransactions,
  categories,
  onMappingChange,
  onConfirm,
  onReset,
}) {
  if (importState === 'idle') return null;

  return (
    <Dialog open={importState !== 'idle'} onOpenChange={onReset}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl rounded-[28px] sm:rounded-[40px] p-0 overflow-hidden border-none shadow-2xl">

        {/* Header */}
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
          <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            {importState === 'processing' && <Loader2 className="animate-spin text-blue-500" />}
            {importState === 'mapping'    && <Filter className="text-orange-500" />}
            {importState === 'confirming' && <Check className="text-green-500" />}
            {importState === 'error'      && <AlertCircle className="text-red-500" />}
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold text-slate-900">
              {importState === 'mapping' ? 'נדרש מיפוי' : 'ייבוא קובץ'}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">{importMessage}</DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 max-h-[50vh] overflow-y-auto bg-white">
          {importState === 'mapping' && (
            <div className="space-y-4">
              {unseenMerchants.map(name => (
                <div key={name} className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-4 rounded-3xl">
                  <span className="flex-1 font-bold text-slate-700 truncate w-full px-2">{name}</span>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Input
                      className="h-12 rounded-2xl bg-white border-transparent shadow-sm"
                      placeholder="שם נקי"
                      value={mappings[name]?.newName || ''}
                      onChange={e => onMappingChange(name, 'newName', e.target.value)}
                    />
                    <Select
                      value={mappings[name]?.category || ''}
                      onValueChange={v => onMappingChange(name, 'category', v)}
                    >
                      <SelectTrigger className="h-12 rounded-2xl bg-white border-transparent shadow-sm w-[160px]">
                        <SelectValue placeholder="קטגוריה" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                        <SelectItem value={CREATE_NEW_CATEGORY_VALUE}>+ חדשה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {importState === 'confirming' && (
            <div className="space-y-2">
              {parsedTransactions.slice(0, 20).map((t, i) => (
                <div key={i} className="flex justify-between text-sm p-4 bg-slate-50 rounded-2xl">
                  <span className="font-bold text-slate-700">{t.description}</span>
                  <span className="font-mono text-slate-900">{t.amount}</span>
                </div>
              ))}
              {parsedTransactions.length > 20 && (
                <p className="text-center text-xs text-slate-400 mt-4 font-medium">
                  ועוד {parsedTransactions.length - 20} עסקאות...
                </p>
              )}
            </div>
          )}

          {['processing', 'finished', 'error'].includes(importState) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {importState === 'finished' && <h3 className="text-2xl font-bold text-green-600 mt-4">הצלחה!</h3>}
              {importState === 'error'    && <h3 className="text-2xl font-bold text-red-600 mt-4">שגיאה</h3>}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
          {['mapping', 'confirming'].includes(importState) ? (
            <div className="flex gap-4 w-full">
              <Button variant="ghost" onClick={onReset} className="flex-1 h-12 rounded-3xl font-bold text-slate-500 hover:bg-slate-200">ביטול</Button>
              <Button onClick={onConfirm} className="flex-1 h-12 rounded-3xl bg-slate-900 font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800">המשך</Button>
            </div>
          ) : (
            <Button onClick={onReset} className="w-full h-12 rounded-3xl bg-white border border-slate-200 font-bold text-slate-900 shadow-sm hover:bg-slate-50">סגור</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
