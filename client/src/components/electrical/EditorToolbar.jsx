/**
 * EditorToolbar - סרגל כלים עליון
 * Top toolbar for the electrical CAD editor
 */
import { useCallback, useRef } from 'react';
import {
  MousePointer2, Move, Pen, Square, Ruler, Type, Eraser,
  ZoomIn, ZoomOut, Grid3X3, Magnet, Undo2, Redo2,
  Save, FolderOpen, Download, Upload, FileImage,
  Eye, EyeOff, Tag, Calculator, Brain, Layers,
  RotateCw, Copy, Trash2, Home, Settings
} from 'lucide-react';
import useElectricalStore from '../../stores/electricalStore';

export default function EditorToolbar({ onSave, onExportPDF, onExportDXF }) {
  const store = useElectricalStore();
  const floorPlanInputRef = useRef(null);

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'בחירה', shortcut: 'V' },
    { id: 'pan', icon: Move, label: 'גרירה', shortcut: 'Space' },
    { id: 'wire', icon: Pen, label: 'חיווט', shortcut: 'W' },
    { id: 'wall', icon: Square, label: 'קיר', shortcut: 'L' },
    { id: 'measure', icon: Ruler, label: 'מדידה', shortcut: 'M' },
    { id: 'text', icon: Type, label: 'טקסט', shortcut: 'T' },
    { id: 'eraser', icon: Eraser, label: 'מחיקה', shortcut: 'E' },
  ];

  const handleFloorPlanUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      store.setFloorPlan(ev.target.result);
      // Canvas component will pick this up
      window.dispatchEvent(new CustomEvent('floorplan-loaded', { detail: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }, []);

  const ToolButton = ({ tool }) => (
    <button
      onClick={() => store.setActiveTool(tool.id)}
      className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-lg transition-all text-xs gap-0.5
        ${store.activeTool === tool.id 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      title={`${tool.label} (${tool.shortcut})`}
    >
      <tool.icon size={18} />
      <span className="text-[10px] leading-tight">{tool.label}</span>
    </button>
  );

  const IconBtn = ({ icon: Icon, label, onClick, active, disabled, badge }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative p-1.5 rounded-lg transition-all
        ${active ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
      `}
      title={label}
    >
      <Icon size={16} />
      {badge && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );

  const Separator = () => <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1" />;

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm" dir="rtl">
      {/* Project Name */}
      <input
        type="text"
        value={store.projectName}
        onChange={(e) => store.setProjectName(e.target.value)}
        className="w-36 px-2 py-1 text-sm font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none dark:text-white text-right"
      />

      <Separator />

      {/* Drawing Tools */}
      <div className="flex items-center gap-0.5">
        {tools.map(tool => (
          <ToolButton key={tool.id} tool={tool} />
        ))}
      </div>

      <Separator />

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5">
        <IconBtn icon={ZoomOut} label="הקטן" onClick={() => store.setZoom(store.zoom - 0.1)} />
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-10 text-center">
          {Math.round(store.zoom * 100)}%
        </span>
        <IconBtn icon={ZoomIn} label="הגדל" onClick={() => store.setZoom(store.zoom + 0.1)} />
        <IconBtn icon={Home} label="איפוס זום" onClick={() => store.setZoom(1)} />
      </div>

      <Separator />

      {/* Grid & Snap */}
      <div className="flex items-center gap-0.5">
        <IconBtn 
          icon={Grid3X3} 
          label="רשת (G)" 
          active={store.gridVisible}
          onClick={() => store.toggleGrid()} 
        />
        <IconBtn 
          icon={Magnet} 
          label="הצמד לרשת" 
          active={store.snapToGrid}
          onClick={() => store.toggleSnap()} 
        />
        <IconBtn 
          icon={store.showMeasurements ? Eye : EyeOff} 
          label="מידות" 
          active={store.showMeasurements}
          onClick={() => store.toggleMeasurements()} 
        />
        <IconBtn 
          icon={Tag} 
          label="תוויות" 
          active={store.showLabels}
          onClick={() => store.toggleLabels()} 
        />
      </div>

      <Separator />

      {/* Edit operations */}
      <div className="flex items-center gap-0.5">
        <IconBtn icon={Undo2} label="בטל (Ctrl+Z)" onClick={() => store.undo()} disabled={!store.history || store.historyIndex < 0} />
        <IconBtn icon={Redo2} label="חזור (Ctrl+Y)" onClick={() => store.redo()} disabled={!store.history || store.historyIndex >= store.history.length - 1} />
        <IconBtn icon={RotateCw} label="סובב 90° (R)" onClick={() => {
          // Dispatch rotation to canvas
          window.dispatchEvent(new CustomEvent('rotate-selected'));
        }} />
        <IconBtn icon={Copy} label="שכפל" onClick={() => {
          store.duplicateElements(store.selectedElementIds);
        }} disabled={store.selectedElementIds.length === 0} />
        <IconBtn icon={Trash2} label="מחק" onClick={() => {
          store.removeElements(store.selectedElementIds);
        }} disabled={store.selectedElementIds.length === 0} />
      </div>

      <Separator />

      {/* Panels Toggle */}
      <div className="flex items-center gap-0.5">
        <IconBtn 
          icon={Layers} 
          label="שכבות" 
          active={store.showLayerPanel}
          onClick={() => store.toggleLayerPanel()} 
        />
        <IconBtn 
          icon={Calculator} 
          label="מחשבון" 
          active={store.showCalculator}
          onClick={() => store.toggleCalculator()} 
        />
        <IconBtn 
          icon={Brain} 
          label="AI חכם" 
          active={store.showAIPanel}
          onClick={() => store.toggleAIPanel()} 
        />
      </div>

      <div className="flex-1" />

      {/* File Operations */}
      <div className="flex items-center gap-0.5">
        <label className="cursor-pointer">
          <IconBtn 
            icon={FileImage} 
            label="העלה תכנית קומה"
            onClick={() => floorPlanInputRef.current?.click()} 
          />
          <input
            ref={floorPlanInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFloorPlanUpload}
          />
        </label>
        <IconBtn icon={Upload} label="ייבא פרויקט" onClick={() => {
          // Import project from JSON
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              try {
                const data = JSON.parse(ev.target.result);
                store.loadProject(data);
              } catch (err) {
                console.error('Invalid project file', err);
              }
            };
            reader.readAsText(file);
          };
          input.click();
        }} />
        <IconBtn icon={Download} label="ייצא פרויקט" onClick={() => {
          const data = store.getProjectData();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${store.projectName || 'project'}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }} />
        {onExportPDF && <IconBtn icon={FileImage} label="ייצא PDF" onClick={onExportPDF} />}
        {onExportDXF && <IconBtn icon={Download} label="ייצא DXF" onClick={onExportDXF} />}
        <IconBtn 
          icon={Save} 
          label="שמור (Ctrl+S)"
          onClick={onSave}
          badge={store.isDirty ? '!' : null}
        />
      </div>
    </div>
  );
}
