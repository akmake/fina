/**
 * ElectricalCADPage - עמוד עורך שרטוט חשמל
 * Main page for the Electrical CAD module
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import useElectricalStore from '../stores/electricalStore';
import api from '../utils/api';

// Components
import EditorToolbar from '../components/electrical/EditorToolbar';
import SymbolPalette from '../components/electrical/SymbolPalette';
import ElectricalCanvas from '../components/electrical/ElectricalCanvas';
import PropertiesPanel from '../components/electrical/PropertiesPanel';
import LayerPanel from '../components/electrical/LayerPanel';
import LoadCalculator from '../components/electrical/LoadCalculator';
import { generateDXF } from '../utils/electricalEngine';

export default function ElectricalCADPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const store = useElectricalStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showProjectList, setShowProjectList] = useState(!projectId);
  const [projects, setProjects] = useState([]);

  // ─────────────────────────────────
  // LOAD PROJECT
  // ─────────────────────────────────
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
    loadProjectList();
  }, [projectId]);

  const loadProject = async (id) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/electrical/projects/${id}`);
      store.loadProject(data.project);
      setShowProjectList(false);
    } catch (err) {
      console.error('Failed to load project:', err);
      toast.error('שגיאה בטעינת הפרויקט');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectList = async () => {
    try {
      const { data } = await api.get('/api/electrical/projects');
      setProjects(data.projects || []);
    } catch (err) {
      // Server routes might not exist yet - that's OK
      console.log('Could not load projects list:', err.message);
    }
  };

  // ─────────────────────────────────
  // SAVE PROJECT
  // ─────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const projectData = store.getProjectData();
      
      if (store.projectId) {
        await api.put(`/api/electrical/projects/${store.projectId}`, projectData);
      } else {
        const { data } = await api.post('/api/electrical/projects', projectData);
        if (data.projectId) {
          store.loadProject({ ...projectData, projectId: data.projectId });
        }
      }
      
      store.markSaved();
      toast.success('הפרויקט נשמר בהצלחה');
    } catch (err) {
      console.error('Failed to save:', err);
      // Fallback: save locally
      const projectData = store.getProjectData();
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      saveAs(blob, `${store.projectName || 'project'}.elec.json`);
      toast.success('הפרויקט נשמר כקובץ מקומי');
    } finally {
      setSaving(false);
    }
  }, [store.projectId]);

  // ─────────────────────────────────
  // EXPORT PDF
  // ─────────────────────────────────
  const handleExportPDF = useCallback(() => {
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a3',
      });

      // Title block
      pdf.setFontSize(16);
      pdf.text(store.projectName || 'שרטוט חשמל', 400, 15, { align: 'right' });
      pdf.setFontSize(10);
      pdf.text(`קנ"מ: 1:${store.projectScale}`, 400, 22, { align: 'right' });
      pdf.text(`תאריך: ${new Date().toLocaleDateString('he-IL')}`, 400, 28, { align: 'right' });

      // Get canvas element and draw to PDF
      const canvasEl = document.querySelector('canvas');
      if (canvasEl) {
        const imgData = canvasEl.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', 10, 35, 400, 260);
      }

      // BOM on second page
      pdf.addPage();
      pdf.setFontSize(14);
      pdf.text('כתב כמויות חשמל', 400, 15, { align: 'right' });
      
      let y = 30;
      pdf.setFontSize(9);
      
      // Group elements
      const groups = {};
      store.elements.forEach(el => {
        if (!groups[el.symbolId]) {
          groups[el.symbolId] = { count: 0, totalWatts: 0 };
        }
        groups[el.symbolId].count++;
        groups[el.symbolId].totalWatts += el.wattage || 0;
      });

      Object.entries(groups).forEach(([symId, data]) => {
        pdf.text(`${symId}: ${data.count} יח' | ${data.totalWatts}W`, 400, y, { align: 'right' });
        y += 6;
      });

      // Circuit summary
      y += 10;
      pdf.setFontSize(12);
      pdf.text('סיכום מעגלים:', 400, y, { align: 'right' });
      y += 8;
      pdf.setFontSize(9);
      
      store.circuits.forEach(circuit => {
        const elems = store.elements.filter(el => el.circuit === circuit.id);
        const watts = elems.reduce((s, el) => s + (el.wattage || 0), 0);
        pdf.text(`${circuit.name}: ${elems.length} אלמנטים | ${watts}W | מפסק ${circuit.breaker}A | כבל ${circuit.cable}mm²`, 400, y, { align: 'right' });
        y += 6;
      });

      pdf.save(`${store.projectName || 'electrical'}_plan.pdf`);
      toast.success('PDF נוצר בהצלחה');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('שגיאה ביצירת PDF');
    }
  }, [store.projectName, store.projectScale, store.elements, store.circuits]);

  // ─────────────────────────────────
  // EXPORT DXF
  // ─────────────────────────────────
  const handleExportDXF = useCallback(() => {
    try {
      const objects = [
        ...store.elements.map(el => ({
          type: 'symbol',
          x: el.x,
          y: el.y,
          symbolId: el.symbolId,
          label: el.label,
          layer: el.layer,
        })),
        ...store.wires.map(w => ({
          type: 'wire',
          points: w.points,
          layer: w.layer,
        })),
        ...store.walls.map(w => ({
          type: 'wall',
          x1: w.x1, y1: w.y1,
          x2: w.x2, y2: w.y2,
        })),
      ];

      const dxfContent = generateDXF(objects, store.projectScale);
      const blob = new Blob([dxfContent], { type: 'application/dxf' });
      saveAs(blob, `${store.projectName || 'electrical'}.dxf`);
      toast.success('קובץ DXF נוצר בהצלחה');
    } catch (err) {
      console.error('DXF export failed:', err);
      toast.error('שגיאה ביצירת DXF');
    }
  }, [store.elements, store.wires, store.walls, store.projectScale, store.projectName]);

  // ─────────────────────────────────
  // Ctrl+S save handler
  // ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // ─────────────────────────────────
  // PROJECT LIST VIEW
  // ─────────────────────────────────
  if (showProjectList && !projectId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" dir="rtl">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <span className="text-3xl">⚡</span>
                שרטוט חשמל - עורך מקצועי
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                צור שרטוטי חשמל מקצועיים לפי תקן ישראלי ת"י 61
              </p>
            </div>
            <button
              onClick={() => {
                store.resetProject();
                setShowProjectList(false);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              פרויקט חדש
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <FeatureCard
              icon="📐"
              title="שרטוט מקצועי"
              description="סמלים לפי תקן, שכבות, חיווט, מדידות וקנה מידה"
            />
            <FeatureCard
              icon="🧮"
              title="חישובים אוטומטיים"
              description="חתכי כבלים, מפסקים, מפלי מתח וכתב כמויות"
            />
            <FeatureCard
              icon="📄"
              title="ייצוא מקצועי"
              description="PDF, DXF (AutoCAD), וכתב כמויות CSV"
            />
          </div>

          {/* Project list */}
          {projects.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">פרויקטים קיימים:</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects.map(project => (
                  <div
                    key={project._id}
                    onClick={() => navigate(`/electrical/${project._id}`)}
                    className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg cursor-pointer transition-all hover:border-blue-300"
                  >
                    <h3 className="font-semibold text-gray-800 dark:text-white">{project.projectName}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {project.elements?.length || 0} אלמנטים | {project.circuits?.length || 0} מעגלים
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      עודכן: {new Date(project.updatedAt).toLocaleString('he-IL')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import local file */}
          <div className="mt-6 text-center">
            <label className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-600">
              או ייבא פרויקט מקובץ JSON
              <input
                type="file"
                accept=".json,.elec.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result);
                      store.loadProject(data);
                      setShowProjectList(false);
                    } catch (err) {
                      toast.error('קובץ לא תקין');
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>

          {/* Keyboard shortcuts reference */}
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">קיצורי מקלדת:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Shortcut keys="V" action="בחירה" />
              <Shortcut keys="W" action="חיווט" />
              <Shortcut keys="L" action="קיר" />
              <Shortcut keys="M" action="מדידה" />
              <Shortcut keys="E" action="מחיקה" />
              <Shortcut keys="R" action="סיבוב 90°" />
              <Shortcut keys="G" action="רשת" />
              <Shortcut keys="Space" action="גרירה" />
              <Shortcut keys="Ctrl+Z" action="בטל" />
              <Shortcut keys="Ctrl+Y" action="שחזר" />
              <Shortcut keys="Ctrl+S" action="שמור" />
              <Shortcut keys="Del" action="מחק נבחר" />
              <Shortcut keys="Esc" action="ביטול" />
              <Shortcut keys="גלגלת" action="זום" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">טוען פרויקט...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────
  // EDITOR VIEW
  // ─────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Toolbar */}
      <EditorToolbar
        onSave={handleSave}
        onExportPDF={handleExportPDF}
        onExportDXF={handleExportDXF}
      />

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Symbol Palette */}
        <SymbolPalette />

        {/* Center: Canvas */}
        <div className="flex-1 relative">
          <ElectricalCanvas />
          
          {/* Floating panels */}
          <LoadCalculator />
          
          {saving && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-50 animate-pulse">
              שומר...
            </div>
          )}
        </div>

        {/* Right: Properties + Layers */}
        <div className="flex">
          <LayerPanel />
          <PropertiesPanel />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────
// Sub-components
// ──────────────────────────
function FeatureCard({ icon, title, description }) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-800 dark:text-white text-sm">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
}

function Shortcut({ keys, action }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-[10px] font-mono shadow-sm">
        {keys}
      </kbd>
      <span>{action}</span>
    </div>
  );
}
