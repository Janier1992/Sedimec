import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Mic, 
  Sliders, 
  BellRing, 
  Layers, 
  History, 
  BarChart3, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Menu, 
  Search, 
  X, 
  Box, 
  Maximize2, 
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { UserProfile, ItemInventario } from '../types';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: 'dashboard' | 'inventario' | 'movimientos';
  setActiveTab: (tab: 'dashboard' | 'inventario' | 'movimientos') => void;
  currentUser: UserProfile;
  totalStock: number;
  lowStockCount?: number;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  onOpenNewMovement: (tipo?: 'Entrada' | 'Salida') => void;
  onOpenVoiceModal: () => void;
  onOpenAuthModal: () => void;
  onOpenThresholdsModal: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inventoryItems: ItemInventario[];
  onOpenSalidaForItem?: (item: ItemInventario) => void;
  onOpenDiagramModal?: (item: ItemInventario) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  totalStock,
  lowStockCount = 0,
  isSidebarVisible,
  onToggleSidebar,
  onOpenNewMovement,
  onOpenVoiceModal,
  onOpenAuthModal,
  onOpenThresholdsModal,
  searchQuery,
  setSearchQuery,
  inventoryItems,
  onOpenSalidaForItem,
  onOpenDiagramModal,
}) => {
  const isAuditor = currentUser.rol === 'auditor';
  const { theme, isDark, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Global hotkey: '/' or 'Cmd/Ctrl + K' focuses the search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsDropdownOpen(true);
      }
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMobileSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time filtering matching by Name (claseEquipo, tipoEquipo), Equipment ID (id), or dimensions
  const matchingItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return inventoryItems.filter((item) => {
      const matchName = item.claseEquipo.toLowerCase().includes(q);
      const matchType = item.tipoEquipo.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      const matchDims = `${item.ancho}x${item.largo}x${item.profundidad}`.includes(q) ||
        `${item.ancho} x ${item.largo} x ${item.profundidad}`.includes(q);
      const matchState = item.estadoEquipo.toLowerCase().includes(q);

      return matchName || matchType || matchId || matchDims || matchState;
    });
  }, [searchQuery, inventoryItems]);

  const handleSelectResult = (item: ItemInventario) => {
    setIsDropdownOpen(false);
    setIsMobileSearchOpen(false);
    setActiveTab('inventario');
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsDropdownOpen(false);
      setIsMobileSearchOpen(false);
      setActiveTab('inventario');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          
          {/* Left: Sidebar Toggle Button & Current View Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            {/* Desktop toggle */}
            <button
              id="btn-toggle-sidebar-desktop"
              onClick={onToggleSidebar}
              aria-label={isSidebarVisible ? 'Ocultar menú lateral' : 'Mostrar menú lateral'}
              title={isSidebarVisible ? 'Ocultar menú lateral' : 'Mostrar menú lateral'}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 text-xs font-bold group ${
                !isSidebarVisible
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md shadow-amber-500/20'
                  : 'text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700'
              }`}
            >
              {!isSidebarVisible ? (
                <>
                  <PanelLeftOpen className="h-4 w-4 text-slate-950" />
                  <span>Mostrar Menú</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                  <span>Ocultar Menú</span>
                </>
              )}
            </button>

            {/* Mobile hamburger menu toggle */}
            <button
              id="btn-toggle-sidebar-mobile"
              onClick={onToggleSidebar}
              aria-label="Abrir menú de opciones"
              title="Abrir menú lateral"
              className="lg:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* View Title */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-slate-400">SEDIMEC S.A.</span>
                <span className="text-slate-600">/</span>
              </div>
              <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 sm:gap-2 truncate">
                {activeTab === 'dashboard' && (
                  <>
                    <BarChart3 className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="truncate">Dashboard</span>
                  </>
                )}
                {activeTab === 'inventario' && (
                  <>
                    <Layers className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="truncate">Inventario</span>
                    <span className="hidden sm:inline-block text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                      {totalStock} piezas
                    </span>
                  </>
                )}
                {activeTab === 'movimientos' && (
                  <>
                    <History className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="truncate">Historial</span>
                  </>
                )}
              </h1>
            </div>
          </div>

          {/* Center: Real-time Search Bar with Live Popover Results */}
          <div 
            ref={searchContainerRef}
            className="flex-1 max-w-xl mx-1 sm:mx-2 relative"
          >
            {/* Desktop / Tablet Search Input */}
            <div className="hidden sm:block relative">
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  ref={inputRef}
                  id="navbar-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length > 0) setIsDropdownOpen(true);
                  }}
                  onKeyDown={handleKeyDownInput}
                  placeholder="Buscar artículos por nombre o ID de equipo en tiempo real..."
                  className="w-full pl-9 pr-16 py-1.5 sm:py-2 bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 focus:border-amber-500 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner"
                />
                
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
                  {searchQuery ? (
                    <button
                      id="navbar-search-clear-btn"
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsDropdownOpen(false);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400">
                      /
                    </kbd>
                  )}
                  {searchQuery && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                      {matchingItems.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Search Toggle Button */}
            <div className="sm:hidden flex justify-end">
              <button
                id="navbar-btn-mobile-search-toggle"
                onClick={() => setIsMobileSearchOpen((prev) => !prev)}
                className={`p-2 rounded-xl border transition-all ${
                  isMobileSearchOpen || searchQuery
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title="Buscar en inventario"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>

            {/* Live Dropdown Results Popover (Desktop / Tablet) */}
            {isDropdownOpen && searchQuery.trim().length > 0 && (
              <div 
                id="navbar-search-dropdown"
                className="hidden sm:block absolute left-0 right-0 top-full mt-2 bg-slate-900/98 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl shadow-slate-950/80 overflow-hidden z-50 animate-in fade-in zoom-in-98 duration-150"
              >
                <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Resultados en tiempo real:
                    </span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-black border border-amber-500/30">
                      {matchingItems.length} {matchingItems.length === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Presiona Enter para filtrar vista
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80 p-1.5">
                  {matchingItems.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 space-y-1">
                      <Box className="h-8 w-8 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-slate-300">
                        No se encontraron piezas que coincidan con "{searchQuery}"
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Intenta con clase de equipo (ej. Viga IPE, Tubo, Plancha), ID o dimensiones.
                      </p>
                    </div>
                  ) : (
                    matchingItems.map((item) => {
                      const isLow = item.saldoActual <= (item.umbralMinimo || 5);
                      return (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl hover:bg-slate-800/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 group cursor-pointer"
                          onClick={() => handleSelectResult(item)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                                {item.claseEquipo}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700 font-medium">
                                {item.tipoEquipo}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-slate-950/80 text-amber-400/90 rounded border border-amber-500/20 truncate max-w-[140px]">
                                ID: {item.id.replace(/__/g, '-').slice(0, 18)}...
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1 font-mono text-slate-300">
                                <Maximize2 className="h-3 w-3 text-slate-500" />
                                {item.ancho} × {item.largo} × {item.profundidad} cm
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="font-mono text-slate-400">
                                {item.volumenUnitarioM3} m³
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                item.estadoEquipo === 'Bueno' || item.estadoEquipo === 'Nuevo'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                              }`}>
                                {item.estadoEquipo}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {/* Stock Badge */}
                            <div className="text-right">
                              <div className={`text-xs font-black px-2 py-0.5 rounded-lg border ${
                                isLow
                                  ? 'bg-rose-950/70 text-rose-300 border-rose-800 animate-pulse'
                                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                              }`}>
                                {item.saldoActual} disp.
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Mostrando <strong className="text-slate-200">{matchingItems.length}</strong> de <strong className="text-slate-200">{inventoryItems.length}</strong> referencias
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setActiveTab('inventario');
                    }}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Ver en Inventario Completo</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Action Controls: Clean Theme Toggle & Profile display */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme Toggle Button */}
            <button
              id="navbar-btn-theme-toggle"
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              aria-label={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-180 duration-200" />
                  <span className="hidden md:inline text-[11px]">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-slate-700 animate-in spin-in-180 duration-200" />
                  <span className="hidden md:inline text-[11px]">Oscuro</span>
                </>
              )}
            </button>

            <button
              id="navbar-btn-user"
              onClick={onOpenAuthModal}
              title="Cambiar rol o usuario / Perfil de sesión"
              className="flex items-center gap-2 p-1 sm:pl-2 sm:pr-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/90 border border-slate-300 dark:border-slate-700/90 rounded-xl transition-all cursor-pointer hover:border-amber-500/50 group shadow-xs"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 ring-1 ring-amber-400/40">
                {currentUser.nombre.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight group-hover:text-amber-600 dark:group-hover:text-white transition-colors">
                  {currentUser.nombre.split(' ')[0]}
                </div>
                <div className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold uppercase leading-none">
                  {currentUser.rol}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar Expansion Panel */}
        {isMobileSearchOpen && (
          <div className="sm:hidden py-2.5 border-t border-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDownInput}
                placeholder="Buscar por nombre o ID de equipo..."
                autoFocus
                className="w-full pl-9 pr-14 py-2 bg-slate-800 border border-amber-500 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSearchOpen(false);
                    if (searchQuery.trim()) setActiveTab('inventario');
                  }}
                  className="p-1 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black"
                >
                  Ir
                </button>
              </div>
            </div>

            {/* Mobile search matches dropdown */}
            {searchQuery.trim().length > 0 && (
              <div className="mt-2 bg-slate-950 rounded-xl border border-slate-800 max-h-60 overflow-y-auto divide-y divide-slate-800/80 p-1">
                {matchingItems.length === 0 ? (
                  <p className="p-3 text-center text-xs text-slate-400">
                    Sin coincidencias para "{searchQuery}"
                  </p>
                ) : (
                  matchingItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectResult(item)}
                      className="p-2 hover:bg-slate-800/80 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{item.claseEquipo}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.ancho}x{item.largo}x{item.profundidad} cm • ID: {item.id.slice(0, 12)}
                        </div>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded">
                        {item.saldoActual} und
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

