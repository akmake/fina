/**
 * LoadCalculator - מחשבון עומסים חשמלי
 * Professional electrical load calculator panel
 */
import { useMemo, useState } from 'react';
import { Calculator, Zap, AlertTriangle, CheckCircle, ChevronDown, Download } from 'lucide-react';
import useElectricalStore from '../../stores/electricalStore';
import { getSymbolById, generateBOM } from './symbols/electricalSymbols';
import {
  analyzeCircuit,
  analyzePanel,
  calculateVoltageDrop,
  selectCableSize,
  suggestRoomElectrical,
} from '../../utils/electricalEngine';

export default function LoadCalculator() {
  const store = useElectricalStore();
  const [activeCalcTab, setActiveCalcTab] = useState('overview'); // overview, circuits, bom, suggestions

  if (!store.showCalculator) return null;

  return (
    <div className="absolute left-64 top-12 w-96 max-h-[calc(100vh-120px)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-l from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
        <Calculator size={18} className="text-blue-600" />
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">מחשבון עומסים</h3>
        <span className="flex-1" />
        <button 
          onClick={() => store.toggleCalculator()}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 text-xs">
        {[
          { id: 'overview', label: 'סקירה' },
          { id: 'circuits', label: 'מעגלים' },
          { id: 'bom', label: 'כתב כמויות' },
          { id: 'suggestions', label: 'המלצות' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCalcTab(tab.id)}
            className={`flex-1 py-2 font-medium transition-colors
              ${activeCalcTab === tab.id 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeCalcTab === 'overview' && <OverviewTab />}
        {activeCalcTab === 'circuits' && <CircuitsAnalysisTab />}
        {activeCalcTab === 'bom' && <BOMTab />}
        {activeCalcTab === 'suggestions' && <SuggestionsTab />}
      </div>
    </div>
  );
}

// ──────────────────────────
// Overview Tab
// ──────────────────────────
function OverviewTab() {
  const store = useElectricalStore();
  
  const stats = useMemo(() => {
    const totalWatts = store.elements.reduce((s, el) => s + (el.wattage || 0), 0);
    const demandWatts = totalWatts * 0.6;
    const totalCurrent = demandWatts / 230;
    
    const byCategory = {};
    store.elements.forEach(el => {
      const sym = getSymbolById(el.symbolId);
      if (!sym) return;
      if (!byCategory[sym.category]) {
        byCategory[sym.category] = { count: 0, watts: 0 };
      }
      byCategory[sym.category].count++;
      byCategory[sym.category].watts += el.wattage || 0;
    });

    const overloadedCircuits = store.circuits.filter(c => {
      const elems = store.elements.filter(el => el.circuit === c.id);
      const watts = elems.reduce((s, el) => s + (el.wattage || 0), 0);
      return watts / 230 > c.breaker;
    });

    return { totalWatts, demandWatts, totalCurrent, byCategory, overloadedCircuits };
  }, [store.elements, store.circuits]);

  return (
    <div className="space-y-3">
      {/* Main stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="הספק כולל" value={`${stats.totalWatts}W`} sub={`${(stats.totalWatts/1000).toFixed(1)} kW`} color="blue" />
        <StatCard label="הספק דרישה" value={`${Math.round(stats.demandWatts)}W`} sub="עם מקדם דרישה 0.6" color="green" />
        <StatCard label="זרם כולל" value={`${stats.totalCurrent.toFixed(1)}A`} sub="פאזה אחת 230V" color="amber" />
        <StatCard label="אלמנטים" value={store.elements.length} sub={`${store.circuits.length} מעגלים`} color="purple" />
      </div>

      {/* Warnings */}
      {stats.overloadedCircuits.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-semibold mb-1">
            <AlertTriangle size={14} />
            מעגלים בעומס יתר!
          </div>
          {stats.overloadedCircuits.map(c => (
            <p key={c.id} className="text-[10px] text-red-500">{c.name} - חריגה מ-{c.breaker}A</p>
          ))}
        </div>
      )}

      {stats.overloadedCircuits.length === 0 && store.elements.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-semibold">
            <CheckCircle size={14} />
            כל המעגלים בטווח תקין
          </div>
        </div>
      )}

      {/* Breakdown by category */}
      <div>
        <h4 className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1.5">פילוח לפי קטגוריה:</h4>
        <div className="space-y-1">
          {Object.entries(stats.byCategory).map(([cat, data]) => (
            <div key={cat} className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-gray-500 dark:text-gray-400 capitalize">{cat}:</span>
              <span className="font-mono dark:text-white">{data.count} יח'</span>
              <span className="text-gray-400">|</span>
              <span className="font-mono dark:text-white">{data.watts}W</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended main panel */}
      {store.elements.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 space-y-1">
          <h4 className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">לוח ראשי מומלץ:</h4>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 space-y-0.5">
            <p>מפסק ראשי: {stats.totalCurrent < 40 ? 40 : stats.totalCurrent < 63 ? 63 : 80}A</p>
            <p>פחת ראשי: {stats.totalCurrent < 40 ? 40 : 63}A / 30mA</p>
            <p>כבל מזין: {stats.totalCurrent < 40 ? 10 : stats.totalCurrent < 63 ? 16 : 25}mm²</p>
            <p>גודל לוח: {Math.ceil((store.circuits.length + 2) / 12) * 12} מודולים</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────
// Circuits Analysis Tab
// ──────────────────────────
function CircuitsAnalysisTab() {
  const store = useElectricalStore();

  return (
    <div className="space-y-2">
      {store.circuits.map(circuit => {
        const elems = store.elements.filter(el => el.circuit === circuit.id);
        const totalWatts = elems.reduce((s, el) => s + (el.wattage || 0), 0);
        const currentA = totalWatts / 230;
        const loadPercent = (currentA / circuit.breaker) * 100;
        const isOverloaded = loadPercent > 100;
        const isWarning = loadPercent > 80;

        return (
          <div key={circuit.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: circuit.color }} />
              <span className="text-xs font-semibold dark:text-white flex-1">{circuit.name}</span>
              {isOverloaded ? (
                <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">עומס יתר!</span>
              ) : isWarning ? (
                <span className="text-[9px] px-1.5 py-0.5 bg-yellow-100 text-yellow-600 rounded-full">אזהרה</span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full">תקין</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <div className="text-center">
                <p className="text-gray-400">הספק</p>
                <p className="font-mono font-semibold dark:text-white">{totalWatts}W</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">זרם</p>
                <p className={`font-mono font-semibold ${isOverloaded ? 'text-red-500' : 'dark:text-white'}`}>
                  {currentA.toFixed(1)}A
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">עומס</p>
                <p className={`font-mono font-semibold ${isOverloaded ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'dark:text-white'}`}>
                  {loadPercent.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Load bar */}
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOverloaded ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, loadPercent)}%` }}
              />
            </div>

            <div className="text-[9px] text-gray-400">
              מפסק: {circuit.breaker}A | כבל: {circuit.cable}mm² | {elems.length} אלמנטים
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────
// BOM (Bill of Materials) Tab
// ──────────────────────────
function BOMTab() {
  const store = useElectricalStore();

  const bom = useMemo(() => {
    return generateBOM(store.elements);
  }, [store.elements]);

  const exportBOM = () => {
    let csv = 'פריט,כמות,הספק ליחידה (W),הספק כולל (W),כבל (mm²)\n';
    bom.forEach(item => {
      csv += `${item.symbol.name},${item.count},${item.symbol.defaultWattage},${item.totalWattage},${item.symbol.cable}\n`;
    });
    
    // Add wiring estimate
    csv += `\nחיווט:\n`;
    csv += `כבל 1.5mm²,${store.wires.filter(w => true).length * 5} מטר (הערכה)\n`;
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `כתב_כמויות_${store.projectName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">כתב כמויות</h4>
        <button
          onClick={exportBOM}
          className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
        >
          <Download size={10} />
          ייצא CSV
        </button>
      </div>

      {bom.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">אין אלמנטים בפרויקט</p>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-[10px]">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-right px-2 py-1.5 text-gray-500 font-medium">פריט</th>
                <th className="text-center px-1 py-1.5 text-gray-500 font-medium">כמות</th>
                <th className="text-center px-1 py-1.5 text-gray-500 font-medium">W</th>
                <th className="text-center px-1 py-1.5 text-gray-500 font-medium">כבל</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((item, i) => (
                <tr key={item.symbol.id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}>
                  <td className="px-2 py-1 dark:text-gray-300">{item.symbol.name}</td>
                  <td className="text-center px-1 py-1 font-mono dark:text-white">{item.count}</td>
                  <td className="text-center px-1 py-1 font-mono dark:text-white">{item.totalWattage}</td>
                  <td className="text-center px-1 py-1 font-mono dark:text-white">{item.symbol.cable}mm²</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-blue-50 dark:bg-blue-900/20">
              <tr>
                <td className="px-2 py-1.5 font-semibold text-blue-700 dark:text-blue-300">סה"כ</td>
                <td className="text-center px-1 py-1.5 font-mono font-semibold text-blue-700 dark:text-blue-300">
                  {bom.reduce((s, item) => s + item.count, 0)}
                </td>
                <td className="text-center px-1 py-1.5 font-mono font-semibold text-blue-700 dark:text-blue-300">
                  {bom.reduce((s, item) => s + item.totalWattage, 0)}
                </td>
                <td className="px-1 py-1.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────
// Suggestions Tab
// ──────────────────────────
function SuggestionsTab() {
  const [roomType, setRoomType] = useState('living_room');
  const [roomWidth, setRoomWidth] = useState(5);
  const [roomHeight, setRoomHeight] = useState(4);

  const suggestion = useMemo(() => {
    return suggestRoomElectrical(roomType, roomWidth, roomHeight);
  }, [roomType, roomWidth, roomHeight]);

  const roomTypes = [
    { id: 'bedroom', name: 'חדר שינה' },
    { id: 'living_room', name: 'סלון' },
    { id: 'kitchen', name: 'מטבח' },
    { id: 'bathroom', name: 'חדר אמבטיה' },
    { id: 'entrance', name: 'כניסה' },
    { id: 'office', name: 'חדר עבודה' },
    { id: 'balcony', name: 'מרפסת' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">המלצות לפי סוג חדר</h4>
        
        <div className="space-y-1.5">
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
          >
            {roomTypes.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
          
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-gray-400">רוחב (מ'):</label>
              <input
                type="number"
                value={roomWidth}
                onChange={(e) => setRoomWidth(Number(e.target.value))}
                className="w-full text-xs p-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
                min="1" max="20" step="0.5"
              />
            </div>
            <div>
              <label className="text-[9px] text-gray-400">עומק (מ'):</label>
              <input
                type="number"
                value={roomHeight}
                onChange={(e) => setRoomHeight(Number(e.target.value))}
                className="w-full text-xs p-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
                min="1" max="20" step="0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {suggestion && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
            המלצות ל{suggestion.name} ({roomWidth}×{roomHeight} מ'):
          </h4>

          {/* Outlets */}
          <SuggestionCategory title="🔌 שקעים" items={suggestion.outlets} />
          
          {/* Lighting */}
          <SuggestionCategory title="💡 תאורה" items={suggestion.lighting} />
          
          {/* Switches */}
          <SuggestionCategory title="🔘 מפסקים" items={suggestion.switches} />
          
          {/* Circuits */}
          <div>
            <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">⚡ מעגלים מומלצים:</p>
            <div className="space-y-0.5 mt-0.5">
              {suggestion.circuits.map((c, i) => (
                <p key={i} className="text-[10px] text-gray-500 dark:text-gray-400 pr-2">
                  • {c.name} - מפסק {c.breaker}A, כבל {c.cable}mm²
                </p>
              ))}
            </div>
          </div>

          {/* Notes */}
          {suggestion.notes && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-1.5">
              {suggestion.notes.map((note, i) => (
                <p key={i} className="text-[10px] text-yellow-700 dark:text-yellow-400">⚠ {note}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionCategory({ title, items }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">{title}</p>
      <div className="space-y-0.5 mt-0.5">
        {items.map((item, i) => (
          <p key={i} className="text-[10px] text-gray-500 dark:text-gray-400 pr-2">
            • {item.count}× {getSymbolById(item.type)?.name || item.type} - {item.placement}
          </p>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  };

  return (
    <div className={`rounded-lg p-2 ${colorClasses[color] || colorClasses.blue}`}>
      <p className="text-[10px] opacity-70">{label}</p>
      <p className="text-base font-bold font-mono">{value}</p>
      {sub && <p className="text-[9px] opacity-60">{sub}</p>}
    </div>
  );
}
