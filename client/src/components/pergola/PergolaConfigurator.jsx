import { useMemo, useState } from 'react';
import {
  MATERIALS, INSTALLATION_TYPES, ROOF_TYPES, FOUNDATION_TYPES,
  WIND_ZONES, FINISHES, LIGHTING_OPTIONS, SIDE_OPTIONS, GUTTER_TYPES,
} from '@/utils/pergolaEngine';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Building2, Ruler, Palette, Wind, Droplets,
  Lightbulb, PanelTop, Columns3, Layers, Shell, DoorOpen,
  ChevronDown, Grid3X3, Hash,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────
function NumberInput({ label, value, onChange, min, max, step = 0.1, unit }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-500">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number" min={min} max={max} step={step}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value) || min)}
            className="w-16 h-7 rounded-lg border border-neutral-200 px-1.5 text-xs text-center bg-white outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
          />
          {unit && <span className="text-[10px] text-neutral-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 appearance-none rounded-full bg-neutral-200 accent-emerald-600 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-600 [&::-webkit-slider-thumb]:appearance-none"
      />
    </div>
  );
}

function IntInput({ label, value, onChange, min, max, unit, hint }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-[11px] text-neutral-500">{label}</span>
        {hint && <span className="text-[9px] text-neutral-400">{hint}</span>}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-600 font-bold text-sm flex items-center justify-center active:bg-neutral-200"
        >−</button>
        <span className="w-8 text-center text-sm font-bold">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-600 font-bold text-sm flex items-center justify-center active:bg-neutral-200"
        >+</button>
        {unit && <span className="text-[10px] text-neutral-400 mr-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full py-3 text-right"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-xs font-bold text-neutral-800">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-3 space-y-2.5">{children}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs rounded-lg border-neutral-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([key, opt]) => (
            <SelectItem key={key} value={key} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProfileSelect({ label, value, onChange, profiles }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs rounded-lg border-neutral-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(profiles).map(([key, p]) => (
            <SelectItem key={key} value={key} className="text-xs">
              {p.label} · {p.weightPerMeter}kg/m · ₪{p.pricePerMeter}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FinishPicker({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-neutral-500">גימור/צבע</span>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(FINISHES).map(([key, f]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={f.label}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              value === key ? 'border-emerald-500 ring-2 ring-emerald-200 scale-110' : 'border-neutral-200 hover:scale-105'
            }`}
            style={{ background: f.hex }}
          />
        ))}
      </div>
      <span className="text-[10px] text-emerald-600 font-medium">{FINISHES[value]?.label}</span>
    </div>
  );
}

function SidePicker({ sides, onChange, installType }) {
  const sideLabels = { front: 'חזית', back: 'גב', left: 'שמאל', right: 'ימין' };
  const disabled = installType === 'wallMounted' ? ['back'] : installType === 'cornerMounted' ? ['back', 'left'] : [];
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(sideLabels).map(([side, label]) => (
        <SelectField
          key={side}
          label={`${label}${disabled.includes(side) ? ' (קיר)' : ''}`}
          value={disabled.includes(side) ? 'none' : sides[side]}
          onChange={v => { if (!disabled.includes(side)) onChange({ ...sides, [side]: v }); }}
          options={SIDE_OPTIONS}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CONFIGURATOR
// ═══════════════════════════════════════════════════════════════════════════════
export default function PergolaConfigurator({ params, onChange, result }) {
  const mat = MATERIALS[params.material] || MATERIALS.pine;
  const set = (key, val) => onChange({ ...params, [key]: val });
  const setMat = (key) => {
    const m = MATERIALS[key];
    onChange({
      ...params, material: key,
      columnProfile: m.defaultColumnProfile, mainBeamProfile: m.defaultMainBeamProfile,
      secBeamProfile: m.defaultSecBeamProfile, rafterProfile: m.defaultRafterProfile,
      finish: 'natural',
    });
  };

  const autoRafters = result?.structure?.numRafters ?? 0;
  const autoSec = result?.structure?.numSecBeams ?? 0;

  return (
    <div className="flex flex-col text-right" dir="rtl">
      {/* ── Material Selector ─────────────────────────────────────── */}
      <Section icon={Layers} title="חומר">
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(MATERIALS).map(([key, m]) => (
            <button
              key={key}
              onClick={() => setMat(key)}
              className={`p-2 rounded-xl border-2 text-right transition-all ${
                params.material === key
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-neutral-100 bg-white hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="text-[11px] font-bold leading-tight">{m.label.split('(')[0].trim()}</span>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Dimensions ────────────────────────────────────────────── */}
      <Section icon={Ruler} title="מידות">
        <NumberInput label="אורך" value={params.length} onChange={v => set('length', v)} min={1.5} max={12} unit="מ'" />
        <NumberInput label="רוחב" value={params.width} onChange={v => set('width', v)} min={1.5} max={8} unit="מ'" />
        <NumberInput label="גובה" value={params.height} onChange={v => set('height', v)} min={2.0} max={4.0} unit="מ'" />
      </Section>

      {/* ── Installation ──────────────────────────────────────────── */}
      <Section icon={Building2} title="סוג התקנה" defaultOpen={false}>
        <SelectField label="סוג" value={params.installType} onChange={v => set('installType', v)} options={INSTALLATION_TYPES} />
      </Section>

      {/* ── Roof ──────────────────────────────────────────────────── */}
      <Section icon={PanelTop} title="גג">
        <SelectField label="כיסוי" value={params.roofType} onChange={v => set('roofType', v)} options={ROOF_TYPES} />
        {ROOF_TYPES[params.roofType]?.needsDrainage && (
          <NumberInput label="שיפוע ניקוז" value={params.slopePercent} onChange={v => set('slopePercent', v)} min={1} max={8} step={0.5} unit="%" />
        )}
        <NumberInput label="שליפה (אוברהנג)" value={params.overhangCM} onChange={v => set('overhangCM', v)} min={0} max={60} step={5} unit='ס"מ' />
      </Section>

      {/* ── Structure Control (NEW!) ──────────────────────────────── */}
      <Section icon={Grid3X3} title="שליטה במבנה">
        <IntInput
          label="עמודים לאורך"
          value={params.manualColsAlongLength || (result?.structure?.colsAlongLength ?? 2)}
          onChange={v => set('manualColsAlongLength', v)}
          min={2} max={12}
          hint="0 = אוטומטי"
        />
        <IntInput
          label="קורות משניות"
          value={params.manualSecBeamCount || autoSec}
          onChange={v => set('manualSecBeamCount', v)}
          min={2} max={20}
          hint={`אוטומטי: ${autoSec}`}
        />
        <Separator className="my-1" />
        <div className="bg-emerald-50/70 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-emerald-600" />
            <span className="text-[11px] font-bold text-emerald-800">שלבים / רפטרים על הגג</span>
          </div>
          <IntInput
            label="מספר שלבים"
            value={params.manualRafterCount || autoRafters}
            onChange={v => set('manualRafterCount', v)}
            min={0} max={60}
            hint={`אוטומטי: ${autoRafters}`}
          />
          <NumberInput
            label="מרווח בין שלבים"
            value={params.manualRafterSpacingCM || (result?.structure?.rafterSpacing ? result.structure.rafterSpacing * 100 : 0)}
            onChange={v => {
              set('manualRafterSpacingCM', v);
              if (v > 0) set('manualRafterCount', 0); // spacing overrides count
            }}
            min={0} max={100} step={1}
            unit='ס"מ'
          />
          <p className="text-[9px] text-emerald-600">הגדר מספר שלבים או מרווח — לא שניהם. 0 = חישוב אוטומטי</p>
        </div>
      </Section>

      {/* ── Profiles ──────────────────────────────────────────────── */}
      <Section icon={Columns3} title="פרופילים" defaultOpen={false}>
        <ProfileSelect label="עמוד" value={params.columnProfile ?? mat.defaultColumnProfile} onChange={v => set('columnProfile', v)} profiles={mat.profiles} />
        <ProfileSelect label="קורה ראשית" value={params.mainBeamProfile ?? mat.defaultMainBeamProfile} onChange={v => set('mainBeamProfile', v)} profiles={mat.profiles} />
        <ProfileSelect label="קורה משנית" value={params.secBeamProfile ?? mat.defaultSecBeamProfile} onChange={v => set('secBeamProfile', v)} profiles={mat.profiles} />
        <ProfileSelect label="שלב/רפטר" value={params.rafterProfile ?? mat.defaultRafterProfile} onChange={v => set('rafterProfile', v)} profiles={mat.profiles} />
      </Section>

      {/* ── Finish ────────────────────────────────────────────────── */}
      <Section icon={Palette} title="גימור">
        <FinishPicker value={params.finish} onChange={v => set('finish', v)} />
      </Section>

      {/* ── Foundation ────────────────────────────────────────────── */}
      <Section icon={Shell} title="יסודות" defaultOpen={false}>
        <SelectField label="סוג יסוד" value={params.foundationType} onChange={v => set('foundationType', v)} options={FOUNDATION_TYPES} />
      </Section>

      {/* ── Wind ──────────────────────────────────────────────────── */}
      <Section icon={Wind} title="אזור רוח" defaultOpen={false}>
        <SelectField label="חשיפת רוח" value={params.windZone} onChange={v => set('windZone', v)} options={WIND_ZONES} />
      </Section>

      {/* ── Sides ─────────────────────────────────────────────────── */}
      <Section icon={DoorOpen} title="חיפויי צד" defaultOpen={false}>
        <SidePicker sides={params.sides} onChange={v => set('sides', v)} installType={params.installType} />
      </Section>

      {/* ── Lighting ──────────────────────────────────────────────── */}
      <Section icon={Lightbulb} title="תאורה" defaultOpen={false}>
        <SelectField label="סוג תאורה" value={params.lightingOption} onChange={v => set('lightingOption', v)} options={LIGHTING_OPTIONS} />
      </Section>

      {/* ── Gutters ───────────────────────────────────────────────── */}
      <Section icon={Droplets} title="מרזבים" defaultOpen={false}>
        <SelectField label="מרזב" value={params.gutterType} onChange={v => set('gutterType', v)} options={GUTTER_TYPES} />
      </Section>
    </div>
  );
}
