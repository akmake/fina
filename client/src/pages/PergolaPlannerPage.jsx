import { useState, useMemo, Suspense, useCallback, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer, Eye, ClipboardList, BarChart3, Download, RotateCcw,
  SlidersHorizontal, X, ChevronUp, Share2, Sparkles,
} from 'lucide-react';
import { MATERIALS, calculatePergola } from '@/utils/pergolaEngine';
import { calcTotalPrice, formatCurrency } from '@/utils/pergolaPrice';
import PergolaConfigurator from '@/components/pergola/PergolaConfigurator';
import CutList from '@/components/pergola/CutList';
import MaterialSummary from '@/components/pergola/MaterialSummary';
import PergolaViewer3D from '@/components/pergola/PergolaViewer3D';

const DEFAULT_PARAMS = {
  length: 4, width: 3, height: 2.7,
  material: 'pine', installType: 'wallMounted',
  roofType: 'openSlats', foundationType: 'surfaceMountBracket',
  windZone: 'inland_normal', finish: 'natural',
  overhangCM: 20, slopePercent: 2,
  lightingOption: 'none', gutterType: 'none',
  sides: { front: 'none', back: 'none', left: 'none', right: 'none' },
  columnProfile: null, mainBeamProfile: null,
  secBeamProfile: null, rafterProfile: null,
  manualRafterCount: 0, manualSecBeamCount: 0,
  manualRafterSpacingCM: 0, manualColsAlongLength: 0,
};

// ── Bottom Sheet ─────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }) {
  const sheetRef = useRef(null);
  const [startY, setStartY] = useState(null);

  const handleTouchStart = (e) => setStartY(e.touches[0].clientY);
  const handleTouchEnd = (e) => {
    if (startY !== null && e.changedTouches[0].clientY - startY > 80) onClose();
    setStartY(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col"
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-neutral-300" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="text-base font-bold">{title}</h2>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Tab Button ───────────────────────────────────────────────────────────
function TabBtn({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all relative ${
        active
          ? 'bg-white text-emerald-700 shadow-sm'
          : 'text-neutral-500 hover:text-neutral-700'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px]">{label}</span>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Stat Pill ────────────────────────────────────────────────────────────
function StatPill({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm">
      {Icon && <Icon className="w-3 h-3 text-emerald-600" />}
      <span className="text-[10px] text-neutral-500">{label}</span>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
}

export default function PergolaPlannerPage() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [activeView, setActiveView] = useState('3d');
  const [configOpen, setConfigOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const result = useMemo(() => {
    try { return calculatePergola(params); }
    catch { return null; }
  }, [params]);

  const pricing = useMemo(() => result ? calcTotalPrice(result) : null, [result]);

  const handleReset = useCallback(() => setParams(DEFAULT_PARAMS), []);

  const handleExport = useCallback(() => {
    if (!result || !pricing) return;
    const lines = [
      'דו"ח מתכנן פרגולות',
      '═'.repeat(40),
      `חומר: ${result.material.label}`,
      `מידות: ${result.input.length}×${result.input.width}×${result.input.height} מ'`,
      `שטח: ${result.coverage.area} מ"ר`,
      `גג: ${result.roof.label}`,
      `צל: ${result.coverage.shadePercent}%`,
      '',
      'רשימת חיתוך:',
      ...result.cutList.map(r => `  ${r.part} — ${r.profile} × ${r.qty} — ${r.lengthM}m — ₪${r.totalPrice}`),
      '',
      'חומרי חיבור:',
      ...Object.values(result.hardware).filter(h => h.qty > 0).map(h => `  ${h.label} × ${h.qty}`),
      '',
      'עלויות:',
      ...pricing.breakdown.map(r => `  ${r.label}: ₪${r.cost}`),
      `  ──────`,
      `  סה"כ: ₪${pricing.total}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pergola-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [result, pricing]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'הפרגולה שלי', text: `פרגולה ${params.length}×${params.width}m — ${pricing ? formatCurrency(pricing.total) : ''}`, url: window.location.href });
      } catch {}
    }
  }, [params, pricing]);

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-stone-100" dir="rtl">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-neutral-200/60">
          <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Hammer className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-neutral-900 leading-tight">מתכנן פרגולות</h1>
                <p className="text-[11px] text-neutral-400">תכנון · הנדסה · תמחור · 3D</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pricing && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg shadow-emerald-200">
                  {formatCurrency(pricing.total)}
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-neutral-500" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-neutral-500" onClick={handleExport}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-6 py-5 grid grid-cols-12 gap-5">
          {/* Sidebar */}
          <div className="col-span-3 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 p-4 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
              <PergolaConfigurator params={params} onChange={setParams} result={result} />
            </div>
          </div>

          {/* Main area */}
          <div className="col-span-9 space-y-4">
            {/* View switcher */}
            <div className="flex items-center gap-2 bg-neutral-100/80 rounded-2xl p-1.5">
              {[
                { id: '3d', label: 'תצוגה 3D', icon: Eye },
                { id: 'cutlist', label: 'רשימת חיתוך', icon: ClipboardList },
                { id: 'summary', label: 'סיכום ותמחור', icon: BarChart3 },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveView(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeView === t.id ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {activeView === '3d' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 overflow-hidden">
                  <Suspense fallback={
                    <div className="w-full h-[600px] animate-pulse bg-neutral-100 flex items-center justify-center text-neutral-400">
                      <Sparkles className="w-6 h-6 animate-spin" />
                    </div>
                  }>
                    <PergolaViewer3D result={result} />
                  </Suspense>
                </div>
                {result && (
                  <div className="flex flex-wrap gap-2">
                    <StatPill label="עמודים" value={result.structure.totalColumns} />
                    <StatPill label="שלבי גג" value={result.structure.numRafters} />
                    <StatPill label='שטח' value={`${result.coverage.area} מ"ר`} />
                    <StatPill label="צל" value={`${result.coverage.shadePercent}%`} />
                    <StatPill label="משקל" value={`${result.loads.totalWeight} kg`} />
                    <StatPill label='מ"ר מוצלים' value={result.coverage.shadedArea} />
                  </div>
                )}
              </div>
            )}

            {activeView === 'cutlist' && (
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 p-5">
                <CutList result={result} />
              </div>
            )}

            {activeView === 'summary' && (
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 p-5">
                <MaterialSummary result={result} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-neutral-50 pb-24" dir="rtl">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Hammer className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold">מתכנן פרגולות</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pricing && (
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                {formatCurrency(pricing.total)}
              </span>
            )}
            <button onClick={handleShare} className="p-2 rounded-full hover:bg-neutral-100">
              <Share2 className="w-4 h-4 text-neutral-500" />
            </button>
            <button onClick={handleExport} className="p-2 rounded-full hover:bg-neutral-100">
              <Download className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-3 pt-3 space-y-3">
        {activeView === '3d' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <Suspense fallback={
                <div className="w-full h-[50vh] animate-pulse bg-neutral-100 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-neutral-300 animate-spin" />
                </div>
              }>
                <PergolaViewer3D result={result} mobile />
              </Suspense>
            </div>
            {result && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: 'עמודים', v: result.structure.totalColumns },
                  { l: 'שלבי גג', v: result.structure.numRafters },
                  { l: 'שטח', v: `${result.coverage.area}m²` },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl p-2.5 text-center shadow-sm">
                    <p className="text-[10px] text-neutral-400">{s.l}</p>
                    <p className="text-sm font-bold mt-0.5">{s.v}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeView === 'cutlist' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <CutList result={result} />
          </div>
        )}

        {activeView === 'summary' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <MaterialSummary result={result} />
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-xl border-t border-neutral-200/60 safe-area-pb">
        <div className="flex items-center justify-around px-2 py-1">
          <TabBtn icon={Eye} label="3D" active={activeView === '3d'} onClick={() => setActiveView('3d')} />
          <TabBtn icon={ClipboardList} label="חיתוך" active={activeView === 'cutlist'} onClick={() => setActiveView('cutlist')} />
          <TabBtn icon={BarChart3} label="סיכום" active={activeView === 'summary'} onClick={() => setActiveView('summary')} />
          <div className="h-8 w-px bg-neutral-200" />
          <TabBtn
            icon={SlidersHorizontal} label="הגדרות"
            active={configOpen}
            onClick={() => setConfigOpen(true)}
            badge={params.material !== 'pine' ? '!' : null}
          />
        </div>
      </nav>

      {/* Config Bottom Sheet */}
      <BottomSheet open={configOpen} onClose={() => setConfigOpen(false)} title="הגדרות פרגולה">
        <PergolaConfigurator params={params} onChange={setParams} result={result} />
        <div className="mt-4 flex gap-2">
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfigOpen(false)}>
            סגור והחל
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
