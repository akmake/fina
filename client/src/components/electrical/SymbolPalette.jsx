/**
 * SymbolPalette - פלטת סמלי חשמל
 * Draggable symbol palette organized by categories
 */
import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronLeft } from 'lucide-react';
import useElectricalStore from '../../stores/electricalStore';
import { getCategoriesWithSymbols, SYMBOL_CATEGORIES, getSymbolById } from './symbols/electricalSymbols';

export default function SymbolPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(
    new Set(Object.keys(SYMBOL_CATEGORIES))
  );
  const store = useElectricalStore();

  const categoriesWithSymbols = useMemo(() => getCategoriesWithSymbols(), []);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categoriesWithSymbols;
    
    const q = searchQuery.trim().toLowerCase();
    return categoriesWithSymbols
      .map(cat => ({
        ...cat,
        symbols: cat.symbols.filter(s =>
          s.name.includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
        ),
      }))
      .filter(cat => cat.symbols.length > 0);
  }, [searchQuery, categoriesWithSymbols]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const handleSymbolClick = (symbol) => {
    store.setActiveSymbolType(symbol.id);
  };

  if (!store.showSymbolPalette) return null;

  return (
    <div className="w-56 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shadow-md" dir="rtl">
      {/* Header */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">סמלי חשמל</h3>
        <div className="relative">
          <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="חפש סמל..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-right dark:text-white"
          />
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredCategories.map(category => (
          <div key={category.id}>
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700"
            >
              <span className="text-base">{category.icon}</span>
              <span className="flex-1 text-right">{category.name}</span>
              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 rounded">
                {category.symbols.length}
              </span>
              {expandedCategories.has(category.id) ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>

            {/* Symbols Grid */}
            {expandedCategories.has(category.id) && (
              <div className="grid grid-cols-2 gap-1 p-1.5">
                {category.symbols.map(symbol => (
                  <button
                    key={symbol.id}
                    onClick={() => handleSymbolClick(symbol)}
                    className={`group flex flex-col items-center p-2 rounded-lg border transition-all
                      ${store.activeSymbolType === symbol.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
                        : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    title={`${symbol.name} (${symbol.nameEn})\n${symbol.defaultWattage}W | כבל: ${symbol.cable}mm²`}
                  >
                    {/* Symbol SVG Preview */}
                    <div
                      className="w-10 h-10 flex items-center justify-center"
                      style={{ color: category.color }}
                      dangerouslySetInnerHTML={{ __html: symbol.svg }}
                    />
                    <span className="text-[10px] text-gray-600 dark:text-gray-400 mt-1 text-center leading-tight line-clamp-2">
                      {symbol.name}
                    </span>
                    {symbol.defaultWattage > 0 && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-500">
                        {symbol.defaultWattage}W
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active Circuit Selector */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <label className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">מעגל פעיל:</label>
        <select
          value={store.activeCircuit}
          onChange={(e) => store.setActiveCircuit(e.target.value)}
          className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {store.circuits.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.breaker}A)
            </option>
          ))}
        </select>
      </div>

      {/* Quick Info */}
      {store.activeSymbolType && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <SymbolInfo symbolId={store.activeSymbolType} />
        </div>
      )}
    </div>
  );
}

function SymbolInfo({ symbolId }) {
  const symbol = getSymbolById(symbolId);
  if (!symbol) return null;

  return (
    <div className="text-xs space-y-1" dir="rtl">
      <p className="font-semibold text-blue-700 dark:text-blue-400">{symbol.name}</p>
      <p className="text-gray-500 text-[10px]">{symbol.nameEn}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-gray-600 dark:text-gray-400">
        <span>הספק: {symbol.defaultWattage}W</span>
        <span>מתח: {symbol.defaultVoltage}V</span>
        <span>כבל: {symbol.cable}mm²</span>
        <span>חיבורים: {symbol.connections.length}</span>
      </div>
      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
        לחץ על הקנבס למיקום הסמל
      </p>
    </div>
  );
}
