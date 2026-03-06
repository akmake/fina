import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/pergolaPrice';
import { Wrench, Package, AlertTriangle } from 'lucide-react';

export default function CutList({ result }) {
  if (!result?.cutList?.length) return null;
  const { cutList, hardware, summary, loads } = result;

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* ── Cut List Table ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-sm">רשימת חיתוך</h3>
          <Badge variant="outline" className="text-[10px] mr-auto">
            מקדם בזבוז: 10%
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="text-right text-xs w-28">חלק</TableHead>
                <TableHead className="text-right text-xs w-28">פרופיל</TableHead>
                <TableHead className="text-center text-xs w-16">אורך (מ')</TableHead>
                <TableHead className="text-center text-xs w-12">כמות</TableHead>
                <TableHead className="text-center text-xs w-20">סה"כ (מ')</TableHead>
                <TableHead className="text-center text-xs w-20">משקל ליח'</TableHead>
                <TableHead className="text-center text-xs w-20">משקל סה"כ</TableHead>
                <TableHead className="text-left text-xs w-24">עלות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cutList.map((row, i) => (
                <TableRow key={i} className="hover:bg-blue-50/40">
                  <TableCell className="text-xs font-medium">{row.part}</TableCell>
                  <TableCell className="text-xs text-neutral-600">{row.profile}</TableCell>
                  <TableCell className="text-center text-xs">{row.lengthM}</TableCell>
                  <TableCell className="text-center text-xs font-bold">{row.qty}</TableCell>
                  <TableCell className="text-center text-xs">{row.totalM}</TableCell>
                  <TableCell className="text-center text-xs">{row.weightPerUnit} kg</TableCell>
                  <TableCell className="text-center text-xs">{row.totalWeight} kg</TableCell>
                  <TableCell className="text-left text-xs font-semibold">{formatCurrency(row.totalPrice)}</TableCell>
                </TableRow>
              ))}
              {/* Summary row */}
              <TableRow className="bg-neutral-100 font-bold">
                <TableCell colSpan={4} className="text-xs">סה"כ</TableCell>
                <TableCell className="text-center text-xs">{summary.totalMaterials} מ'</TableCell>
                <TableCell />
                <TableCell className="text-center text-xs">{summary.totalWeight} kg</TableCell>
                <TableCell className="text-left text-xs">{formatCurrency(summary.materialCost)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Hardware List ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-sm">רשימת חומרי חיבור</h3>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="text-right text-xs">פריט</TableHead>
                <TableHead className="text-center text-xs w-14">כמות</TableHead>
                <TableHead className="text-center text-xs w-20">מחיר ליח'</TableHead>
                <TableHead className="text-left text-xs w-24">סה"כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(hardware).filter(h => h.qty > 0).map((h, i) => (
                <TableRow key={i} className="hover:bg-blue-50/40">
                  <TableCell className="text-xs">{h.label}</TableCell>
                  <TableCell className="text-center text-xs font-bold">{h.qty}</TableCell>
                  <TableCell className="text-center text-xs">{formatCurrency(h.priceEach)}</TableCell>
                  <TableCell className="text-left text-xs font-semibold">{formatCurrency(h.qty * h.priceEach)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Structural Notes ──────────────────────────────────────── */}
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h4 className="text-xs font-bold text-amber-800">נתוני עומסים</h4>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-amber-900">
          <span>משקל מבנה: {loads.structuralWeight} kg</span>
          <span>משקל חומר גג: {loads.roofMaterialWeight} kg</span>
          <span>עומס חי (50 kg/m²): {loads.totalLiveLoad} kg</span>
          <span>עומס תכנון (×1.25): {loads.totalDesignLoad} kg</span>
          <span>עומס ליסוד: {loads.designLoadPerFooting} kg</span>
          <span>כוח רוח (uplift): {loads.windUpliftForceN} N</span>
        </div>
        <p className="text-[10px] mt-2 text-amber-700">* נתונים אלו להערכה בלבד — נדרש אישור מהנדס מבנים</p>
      </div>
    </div>
  );
}
