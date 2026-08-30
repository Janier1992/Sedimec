import React, { useState } from 'react';
import { 
  BarChart3, 
  Layers, 
  History, 
  Menu, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Mic, 
  X,
  Sliders,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';

interface MobileBottomNavProps {
  activeTab: 'dashboard' | 'inventario' | 'movimientos';
  setActiveTab: (tab: 'dashboard' | 'inventario' | 'movimientos') => void;
  totalStock: number;
  lowStockCount: number;
  currentUser: UserProfile;
  onToggleMobileMenu: () => void;
  onOpenNewMovement: (tipo?: 'Entrada' | 'Salida') => void;
  onOpenVoiceModal: () => void;
  onOpenThresholdsModal: () => void;
  onOpenDiagramGenerator: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  totalStock,
  lowStockCount,
  currentUser,
  onToggleMobileMenu,
  onOpenNewMovement,
  onOpenVoiceModal,
}) => {
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const isAuditor = currentUser.rol === 'auditor';

  const handleAction = (cb: () => void) => {
    setIsFabMenuOpen(false);
    cb();
  };

  return (
    <>
      {/* Pop-up Quick Actions Menu when clicking the central + FAB button on mobile */}
      {isFabMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex items-end justify-center pb-20 px-4">
          <div 
            onClick={() => setIsFabMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          />

          <div className="relative z-50 w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-2 animate-in slide-in-from-bottom-4 duration-200 text-white">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Operaciones Rápidas
              </span>
              <button 
                onClick={() => setIsFabMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => handleAction(() => onOpenNewMovement('Entrada'))}
              disabled={isAuditor}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 font-extrabold text-xs transition-all disabled:opacity-50"
            >
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
              <div className="text-left flex-1">
                <div className="text-white">+ Nueva Entrada (Recepción)</div>
                <div className="text-[10px] text-emerald-400 font-normal">Ingreso de materiales al patio</div>
              </div>
            </button>

            <button
              onClick={() => handleAction(() => onOpenNewMovement('Salida'))}
              disabled={isAuditor}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-sky-950/60 hover:bg-sky-900 border border-sky-800/60 text-sky-300 font-extrabold text-xs transition-all disabled:opacity-50"
            >
              <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-xl">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div className="text-left flex-1">
                <div className="text-white">- Nueva Salida (Despacho)</div>
                <div className="text-[10px] text-sky-400 font-normal">Entrega o salida hacia obra / cliente</div>
              </div>
            </button>

            <button
              onClick={() => handleAction(onOpenVoiceModal)}
              disabled={isAuditor}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-violet-950/70 to-indigo-950/70 hover:from-violet-900 hover:to-indigo-900 border border-violet-800/60 text-violet-300 font-extrabold text-xs transition-all disabled:opacity-50"
            >
              <div className="p-1.5 bg-violet-500/20 text-violet-300 rounded-xl">
                <Mic className="h-4 w-4 animate-pulse" />
              </div>
              <div className="text-left flex-1">
                <div className="text-white flex items-center gap-2">
                  <span>Dictado por Voz Inteligente</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/30 text-violet-200">AI</span>
                </div>
                <div className="text-[10px] text-violet-300 font-normal">Registro automático con Gemini AI</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav 
        id="mobile-bottom-nav"
        className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-white lg:hidden px-3 py-1.5 shadow-2xl safe-area-pb"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Dashboard Tab */}
          <button
            id="mobile-nav-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-amber-400 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <BarChart3 className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Dashboard</span>
          </button>

          {/* Inventario Tab */}
          <button
            id="mobile-nav-inventario"
            onClick={() => setActiveTab('inventario')}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'inventario'
                ? 'text-amber-400 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Layers className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Inventario</span>
            {lowStockCount > 0 ? (
              <span className="absolute top-0.5 right-2 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            ) : null}
          </button>

          {/* Center Quick Action Trigger Button (FAB) */}
          <button
            id="mobile-nav-fab-action"
            onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
            title="Acciones rápidas"
            className="flex flex-col items-center justify-center -mt-5 transition-transform active:scale-95 cursor-pointer"
          >
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-slate-900">
              <Plus className={`h-6 w-6 transition-transform duration-200 ${isFabMenuOpen ? 'rotate-45' : ''}`} />
            </div>
            <span className="text-[9px] font-bold text-amber-400 mt-0.5">Acciones</span>
          </button>

          {/* Historial Tab */}
          <button
            id="mobile-nav-movimientos"
            onClick={() => setActiveTab('movimientos')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'movimientos'
                ? 'text-amber-400 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <History className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Historial</span>
          </button>

          {/* Mobile Drawer Menu Toggle Button */}
          <button
            id="mobile-nav-toggle-menu"
            onClick={onToggleMobileMenu}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-amber-400 transition-all cursor-pointer"
          >
            <Menu className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
};
