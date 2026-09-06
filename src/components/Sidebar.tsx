import React from 'react';
import { 
  Package, 
  BarChart3, 
  Layers, 
  History, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Mic,
  Sliders,
  ChevronLeft,
  ChevronRight, 
  BellRing,
  PanelLeftClose,
  X,
  Sun,
  Moon,
  ShieldCheck,
  Users
} from 'lucide-react';
import { UserProfile } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  activeTab: 'dashboard' | 'inventario' | 'movimientos';
  setActiveTab: (tab: 'dashboard' | 'inventario' | 'movimientos') => void;
  currentUser: UserProfile;
  totalStock: number;
  totalMovements: number;
  lowStockCount: number;
  isSidebarVisible: boolean;
  setIsSidebarVisible: (visible: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onOpenNewMovement: (tipo?: 'Entrada' | 'Salida') => void;
  onOpenVoiceModal: () => void;
  onOpenAuthModal: () => void;
  onOpenThresholdsModal: () => void;
  onOpenIntegrityModal: () => void;
  onOpenUserManagementModal: () => void;
  onOpenDiagramGenerator: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  totalStock,
  totalMovements,
  lowStockCount,
  isSidebarVisible,
  setIsSidebarVisible,
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed,
  setIsCollapsed,
  onOpenNewMovement,
  onOpenVoiceModal,
  onOpenAuthModal,
  onOpenThresholdsModal,
  onOpenIntegrityModal,
  onOpenUserManagementModal,
  onOpenDiagramGenerator,
}) => {
  const isAuditor = currentUser.rol === 'auditor';
  const isAdminUser = currentUser.rol === 'admin';
  const { isDark, toggleTheme } = useTheme();

  const handleSelectTab = (tab: 'dashboard' | 'inventario' | 'movimientos') => {
    setActiveTab(tab);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const handleActionClick = (action: () => void) => {
    action();
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  // Common inner sidebar content shared between desktop & mobile drawer
  const renderSidebarContent = (isMobileMode: boolean) => {
    const showExpanded = isMobileMode || !isCollapsed;

    return (
      <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
        {/* Brand Header */}
        <div className="h-16 px-3.5 flex items-center justify-between border-b border-slate-800/90 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40">
              <Package className="h-5 w-5 text-slate-950 font-black" />
            </div>

            {showExpanded && (
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm tracking-tight text-white">SEDIMEC</span>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                    S.A.
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate">
                  Patio & Trazabilidad
                </p>
              </div>
            )}
          </div>

          {/* Controls: Mobile close button or Desktop collapse/hide button */}
          <div className="flex items-center gap-1">
            {isMobileMode ? (
              <button
                id="sidebar-mobile-btn-close"
                onClick={() => setIsMobileOpen(false)}
                title="Cerrar menú"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5 text-slate-300" />
              </button>
            ) : (
              <>
                <button
                  id="sidebar-btn-collapse-toggle"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  title={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú a iconos'}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>

                {!isCollapsed && (
                  <button
                    id="sidebar-btn-hide-top"
                    onClick={() => setIsSidebarVisible(false)}
                    title="Ocultar menú lateral"
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Main Navigation Section */}
          <div className="space-y-1">
            {showExpanded && (
              <div className="flex items-center justify-between px-3 mb-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400/80">
                  Módulos de Gestión
                </p>
              </div>
            )}

            {/* Dashboard Tab */}
            <button
              id={`sidebar-nav-dashboard${isMobileMode ? '-mobile' : ''}`}
              onClick={() => handleSelectTab('dashboard')}
              title={!showExpanded ? 'Dashboard General' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <BarChart3 className={`h-4 w-4 shrink-0 ${activeTab === 'dashboard' ? 'text-slate-950' : 'text-amber-400'}`} />
              {showExpanded && (
                <span className="truncate flex-1 text-left">Dashboard General</span>
              )}
            </button>

            {/* Inventario Tab */}
            <button
              id={`sidebar-nav-inventario${isMobileMode ? '-mobile' : ''}`}
              onClick={() => handleSelectTab('inventario')}
              title={!showExpanded ? `Inventario en Patio (${totalStock})` : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'inventario'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Layers className={`h-4 w-4 shrink-0 ${activeTab === 'inventario' ? 'text-slate-950' : 'text-amber-400'}`} />
              {showExpanded && (
                <div className="flex items-center justify-between flex-1 truncate">
                  <span className="text-left">Inventario en Patio</span>
                  <div className="flex items-center gap-1">
                    {lowStockCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                        {lowStockCount}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      activeTab === 'inventario' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {totalStock}
                    </span>
                  </div>
                </div>
              )}
            </button>

            {/* Historial Tab */}
            <button
              id={`sidebar-nav-movimientos${isMobileMode ? '-mobile' : ''}`}
              onClick={() => handleSelectTab('movimientos')}
              title={!showExpanded ? `Historial de Movimientos (${totalMovements})` : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'movimientos'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-black'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <History className={`h-4 w-4 shrink-0 ${activeTab === 'movimientos' ? 'text-slate-950' : 'text-amber-400'}`} />
              {showExpanded && (
                <div className="flex items-center justify-between flex-1 truncate">
                  <span className="text-left">Trazabilidad & Historial</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    activeTab === 'movimientos' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {totalMovements}
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* Configuration & Controls Section */}
          <div className="space-y-1.5 pt-3 border-t border-slate-800/80">
            {showExpanded && (
              <p className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400/80 mb-2">
                Configuración
              </p>
            )}

            {/* Stock Thresholds & Alerts Manager */}
            <button
              id={`sidebar-btn-thresholds${isMobileMode ? '-mobile' : ''}`}
              onClick={() => handleActionClick(onOpenThresholdsModal)}
              title={!showExpanded ? `Umbrales & Alertas de Stock (${lowStockCount} alertas)` : undefined}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer group"
            >
              <div className="p-1 rounded-lg bg-slate-800 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <Sliders className="h-3.5 w-3.5" />
              </div>
              {showExpanded && (
                <div className="flex items-center justify-between flex-1 truncate">
                  <span className="text-left">Umbrales & Alertas</span>
                  {lowStockCount > 0 && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black animate-pulse">
                      <BellRing className="h-2.5 w-2.5" />
                      {lowStockCount}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Integrity Audit Engine */}
            <button
              id={`sidebar-btn-integrity${isMobileMode ? '-mobile' : ''}`}
              onClick={() => handleActionClick(onOpenIntegrityModal)}
              title={!showExpanded ? 'Auditoría de Integridad de Inventario' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer group"
            >
              <div className="p-1 rounded-lg bg-slate-800 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              {showExpanded && <span className="text-left flex-1 truncate">Auditoría de Integridad</span>}
            </button>

            {/* Gestión de Usuarios (solo Administrador) */}
            {isAdminUser && (
              <button
                id={`sidebar-btn-users${isMobileMode ? '-mobile' : ''}`}
                onClick={() => handleActionClick(onOpenUserManagementModal)}
                title={!showExpanded ? 'Gestión de Usuarios' : undefined}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer group"
              >
                <div className="p-1 rounded-lg bg-slate-800 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-slate-950 transition-colors">
                  <Users className="h-3.5 w-3.5" />
                </div>
                {showExpanded && <span className="text-left flex-1 truncate">Gestión de Usuarios</span>}
              </button>
            )}
          </div>
        </div>

        {/* Footer Section: User Profile & Dedicated "Ocultar Menú" Option */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0 space-y-2">
          {/* Dedicated Theme Mode Switcher */}
          <button
            id={`sidebar-btn-theme-toggle${isMobileMode ? '-mobile' : ''}`}
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/80 text-slate-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center justify-center text-amber-400 group-hover:text-amber-300">
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-sky-400" />}
              </div>
              {showExpanded && (
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                    {isDark ? 'Tema Oscuro Activo' : 'Tema Claro Activo'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isDark ? 'Clic para modo claro' : 'Clic para modo oscuro'}
                  </div>
                </div>
              )}
            </div>
            {showExpanded && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300">
                {isDark ? '🌙 Oscuro' : '☀️ Claro'}
              </span>
            )}
          </button>

          {/* User Profile / Role */}
          <button
            id={`sidebar-btn-user-profile${isMobileMode ? '-mobile' : ''}`}
            onClick={() => handleActionClick(onOpenAuthModal)}
            title={!showExpanded ? `${currentUser.nombre} (${currentUser.rol})` : 'Cambiar perfil / rol de usuario'}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/80 transition-all cursor-pointer text-left group"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center ring-2 ring-amber-400/30 shrink-0">
              {currentUser.nombre.charAt(0)}
            </div>

            {showExpanded && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                  {currentUser.nombre}
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 truncate">{currentUser.cargo}</span>
                  <span className={`px-1.5 py-0.2 rounded font-extrabold uppercase text-[9px] ${
                    currentUser.rol === 'admin'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : currentUser.rol === 'operador'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {currentUser.rol}
                  </span>
                </div>
              </div>
            )}
          </button>

          {/* Dedicated Button to explicitly Hide Sidebar */}
          {!isMobileMode ? (
            <button
              id="sidebar-btn-hide-bottom"
              onClick={() => setIsSidebarVisible(false)}
              title="Ocultar menú lateral"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-amber-300 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
            >
              <PanelLeftClose className="h-4 w-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
              {showExpanded && (
                <span className="text-[11px] font-semibold">Ocultar Menú Lateral</span>
              )}
            </button>
          ) : (
            <button
              id="sidebar-btn-close-drawer-bottom"
              onClick={() => setIsMobileOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
            >
              <X className="h-4 w-4 text-slate-400" />
              <span>Cerrar Menú</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── 1. DESKTOP PERMANENT STATIC SIDEBAR (Visible on lg: screens and up) ── */}
      {isSidebarVisible && (
        <aside
          id="app-sidebar-desktop"
          className={`hidden lg:flex sticky top-0 h-screen z-30 shrink-0 flex-col bg-slate-900 border-r border-slate-800 text-slate-100 transition-all duration-300 ease-in-out select-none shadow-xl ${
            isCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          {renderSidebarContent(false)}
        </aside>
      )}

      {/* ── 2. MOBILE OFF-CANVAS SLIDE-OVER DRAWER (Visible on < lg: screens when toggled) ── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop overlay */}
          <div
            id="sidebar-mobile-backdrop"
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer panel */}
          <aside
            id="app-sidebar-mobile"
            className="relative z-50 w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200"
          >
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
