import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  CheckCircle2,
  PanelLeftOpen
} from 'lucide-react';
import {
  Movimiento,
  ItemInventario,
  KpiMetrics,
  UserProfile,
  TipoMovimiento,
  ParsedVoiceMovement
} from './types';
import {
  fetchMovements,
  fetchInventory,
  fetchKpis,
  createMovement,
  deleteMovement,
  deleteInventoryReference,
  sendStockAlertEmail
} from './services/api';
import { supabase } from './lib/supabaseClient';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { MovementsHistoryView } from './components/MovementsHistoryView';
import { MovementFormModal } from './components/MovementFormModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { PieceDiagramGeneratorModal } from './components/PieceDiagramGeneratorModal';
import { MovementDetailModal } from './components/MovementDetailModal';
import { AuthModal } from './components/AuthModal';
import { StockThresholdsModal } from './components/StockThresholdsModal';
import { IntegrityCheckModal } from './components/IntegrityCheckModal';
import { UserManagementModal } from './components/UserManagementModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ConversationalAgentWidget } from './components/ConversationalAgentWidget';

export default function App() {
  // Auth / session state (Supabase Auth es la única fuente de verdad del usuario y su rol)
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventario' | 'movimientos'>('dashboard');

  // Data states
  const [movements, setMovements] = useState<Movimiento[]>([]);
  const [inventoryItems, setInventoryItems] = useState<ItemInventario[]>([]);
  const [kpis, setKpis] = useState<KpiMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementModalTipo, setMovementModalTipo] = useState<TipoMovimiento>('Entrada');
  const [movementModalInitialItem, setMovementModalInitialItem] = useState<ItemInventario | null>(null);
  const [movementModalInitialParsedVoice, setMovementModalInitialParsedVoice] = useState<ParsedVoiceMovement | null>(null);

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedMovementForDetail, setSelectedMovementForDetail] = useState<Movimiento | null>(null);

  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [diagramPieceInfo, setDiagramPieceInfo] = useState<{
    tipoEquipo: string;
    claseEquipo: string;
    ancho: number;
    largo: number;
    profundidad: number;
    estadoEquipo: string;
  } | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isThresholdsModalOpen, setIsThresholdsModalOpen] = useState(false);
  const [isIntegrityModalOpen, setIsIntegrityModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sedimec_onboarding_completed') !== 'true';
    }
    return false;
  });

  // Sidebar navigation states
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── Sesión y perfil (Supabase Auth + tabla profiles) ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setCurrentUser(null);
      setProfileLoadError(null);
      return;
    }
    supabase
      .from('profiles')
      .select('id, nombre, email, rol, cargo, avatar_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('Error cargando perfil de usuario:', error);
          setProfileLoadError(
            'No se pudo cargar tu perfil. Es posible que tu cuenta haya sido eliminada o que tu sesión haya quedado inválida.'
          );
          return;
        }
        setProfileLoadError(null);
        setCurrentUser({
          id: data.id,
          nombre: data.nombre,
          email: data.email,
          rol: data.rol,
          cargo: data.cargo,
          avatarUrl: data.avatar_url,
        });
      });
  }, [session?.user?.id]);

  // Load all app data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [movRes, invRes, kpiRes] = await Promise.all([
        fetchMovements(),
        fetchInventory(),
        fetchKpis(),
      ]);

      setMovements(movRes.data);
      setInventoryItems(invRes.data);
      setKpis(kpiRes);
      setDataLoadError(null);
    } catch (err: unknown) {
      console.error('Error cargando datos:', err);
      const msg = err instanceof Error ? err.message : 'Error conectando con el servidor de inventario';
      setDataLoadError(msg);
      showToast('error', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  // Las pestañas en segundo plano por mucho tiempo hacen que el navegador retrase
  // la renovación automática del token de sesión -- al volver a la pestaña se
  // refresca la sesión explícitamente y se recargan los datos, para no depender
  // de que el usuario tenga que recargar la página manualmente.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        supabase.auth.refreshSession().finally(() => loadData());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, loadData]);

  // Create movement handler with instant feedback
  const handleCreateMovement = async (data: Omit<Movimiento, 'id' | 'saldoResultante' | 'volumenM3'>) => {
    try {
      const response = await createMovement({
        ...data,
        responsable: data.responsable || currentUser?.nombre,
      });

      const newMov = response.movimiento;

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: data.tipoMovimiento === 'Entrada' ? ['#10b981', '#34d399', '#f59e0b'] : ['#0ea5e9', '#38bdf8', '#f59e0b'],
      });

      showToast(
        'success',
        `Movimiento registrado: ${newMov.codigoLote} (${newMov.tipoMovimiento} de ${newMov.cantidad} und)`
      );

      // Alerta de stock bajo: fire-and-forget, no bloquea la respuesta al usuario.
      // El umbral real se re-consulta después de refrescar el inventario.
      if (newMov.tipoMovimiento === 'Salida') {
        fetchInventory()
          .then(({ data: items }) => {
            const item = items.find(
              (i) =>
                i.tipoEquipo.trim().toLowerCase() === newMov.tipoEquipo.trim().toLowerCase() &&
                i.claseEquipo.trim().toLowerCase() === newMov.claseEquipo.trim().toLowerCase() &&
                i.ancho === newMov.ancho && i.largo === newMov.largo && i.profundidad === newMov.profundidad
            );
            if (item?.alertaStockBajo) {
              sendStockAlertEmail({
                tipoEquipo: newMov.tipoEquipo,
                claseEquipo: newMov.claseEquipo,
                saldoActual: item.saldoActual,
                umbralConfigurado: item.umbralMinimo,
              }).catch((err) => console.error('Error despachando alerta de stock:', err));
            }
          })
          .catch((err) => console.error('Error verificando umbral tras movimiento:', err));
      }

      await loadData();
      setIsMovementModalOpen(false);
      setIsVoiceModalOpen(false);
      setSelectedMovementForDetail(newMov);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar movimiento';
      showToast('error', errorMsg);
      throw err;
    }
  };

  // Anular movimiento (soft-delete de auditoría, solo Admin vía RPC + RLS)
  const handleDeleteMovement = async (id: string) => {
    if (currentUser?.rol !== 'admin') {
      showToast('error', 'Solo el perfil Administrador puede anular movimientos.');
      return;
    }

    try {
      await deleteMovement(id);
      showToast('success', 'Movimiento anulado y saldo de inventario recalculado correctamente.');
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error anulando movimiento';
      showToast('error', errorMsg);
    }
  };

  const handleOpenNewMovement = (tipo?: TipoMovimiento, item?: ItemInventario) => {
    if (currentUser?.rol === 'auditor') {
      showToast('error', 'Acceso denegado: El perfil Auditor tiene permisos de solo lectura.');
      return;
    }
    setMovementModalTipo(tipo || 'Entrada');
    setMovementModalInitialItem(item || null);
    setMovementModalInitialParsedVoice(null);
    setIsMovementModalOpen(true);
  };

  const handleOpenSalidaForItem = (item: ItemInventario) => {
    if (currentUser?.rol === 'auditor') {
      showToast('error', 'Acceso denegado: El perfil Auditor tiene permisos de solo lectura.');
      return;
    }
    if (item.saldoActual <= 0) {
      showToast('error', `No hay existencias disponibles de "${item.claseEquipo}" para realizar salida.`);
      return;
    }
    setMovementModalTipo('Salida');
    setMovementModalInitialItem(item);
    setMovementModalInitialParsedVoice(null);
    setIsMovementModalOpen(true);
  };

  const handleDeleteInventoryReference = async (item: ItemInventario) => {
    if (currentUser?.rol !== 'admin') {
      showToast('error', 'Solo el perfil Administrador puede eliminar referencias de inventario.');
      return;
    }
    const confirmado = window.confirm(
      `¿Eliminar por completo la referencia "${item.claseEquipo}" (${item.tipoEquipo})? Esto anulará los ${item.totalEntradas + item.totalSalidas} movimiento(s) de su historial (quedan archivados como anulados, no se borran físicamente).`
    );
    if (!confirmado) return;

    try {
      const res = await deleteInventoryReference(item);
      showToast('success', res.mensaje);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la referencia';
      showToast('error', msg);
    }
  };

  const handleVoiceReviewInForm = (parsed: ParsedVoiceMovement, rawTranscript: string) => {
    setMovementModalTipo(parsed.tipoMovimiento);
    setMovementModalInitialItem(null);
    setMovementModalInitialParsedVoice({
      ...parsed,
      observaciones: parsed.observaciones || `Dictado por voz: "${rawTranscript}"`,
    });
    setIsMovementModalOpen(true);
  };

  const handleOpenDiagramModal = (itemOrInfo: ItemInventario | {
    tipoEquipo: string;
    claseEquipo: string;
    ancho: number;
    largo: number;
    profundidad: number;
    estadoEquipo: string;
  }) => {
    setDiagramPieceInfo({
      tipoEquipo: itemOrInfo.tipoEquipo,
      claseEquipo: itemOrInfo.claseEquipo,
      ancho: itemOrInfo.ancho,
      largo: itemOrInfo.largo,
      profundidad: itemOrInfo.profundidad,
      estadoEquipo: itemOrInfo.estadoEquipo,
    });
    setIsDiagramModalOpen(true);
  };

  const guardAuditor = (action: () => void) => {
    if (currentUser?.rol === 'auditor') {
      showToast('error', 'Acceso denegado: El perfil Auditor no puede registrar movimientos.');
      return;
    }
    action();
  };

  const totalStock = inventoryItems.reduce((acc, i) => acc + Math.max(0, i.saldoActual), 0);
  const lowStockCount = inventoryItems.filter((i) => i.alertaStockBajo).length;

  // ── Pantalla de acceso: sin sesión no se renderiza el aplicativo ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (session && !currentUser && profileLoadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 text-center space-y-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl inline-flex mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">No se pudo cargar tu cuenta</h2>
            <p className="text-xs text-slate-500 mt-1">{profileLoadError}</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar sesión e intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (!session || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950">
        <AuthModal isOpen onClose={() => {}} currentUser={null} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col lg:flex-row selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200">

      {/* 1. Lateral Navigation Menu (Sidebar: Desktop Static + Mobile Off-Canvas Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        totalStock={totalStock}
        totalMovements={movements.length}
        lowStockCount={lowStockCount}
        isSidebarVisible={isSidebarVisible}
        setIsSidebarVisible={setIsSidebarVisible}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        onOpenNewMovement={handleOpenNewMovement}
        onOpenVoiceModal={() => guardAuditor(() => setIsVoiceModalOpen(true))}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenThresholdsModal={() => setIsThresholdsModalOpen(true)}
        onOpenIntegrityModal={() => setIsIntegrityModalOpen(true)}
        onOpenUserManagementModal={() => setIsUserManagementModalOpen(true)}
        onOpenDiagramGenerator={() => {
          setDiagramPieceInfo({
            tipoEquipo: 'Estructura Metálica',
            claseEquipo: 'Viga IPE 300 Estructural',
            ancho: 15,
            largo: 600,
            profundidad: 30,
            estadoEquipo: 'Bueno',
          });
          setIsDiagramModalOpen(true);
        }}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          totalStock={totalStock}
          lowStockCount={lowStockCount}
          isSidebarVisible={isSidebarVisible}
          onToggleSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setIsMobileSidebarOpen((prev) => !prev);
            } else {
              setIsSidebarVisible((prev) => !prev);
            }
          }}
          onOpenNewMovement={handleOpenNewMovement}
          onOpenVoiceModal={() => guardAuditor(() => setIsVoiceModalOpen(true))}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenThresholdsModal={() => setIsThresholdsModalOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          inventoryItems={inventoryItems}
          onOpenSalidaForItem={handleOpenSalidaForItem}
          onOpenDiagramModal={(item) => handleOpenDiagramModal(item)}
        />

        <main className="flex-1 w-full max-w-[1750px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-8">
          {isLoading && !kpis ? (
            <div className="py-32 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Sincronizando existencias de Sedimec...
              </p>
            </div>
          ) : dataLoadError && !kpis ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4 text-center max-w-md mx-auto">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">No se pudo cargar el inventario</h2>
                <p className="text-xs text-slate-500 mt-1">{dataLoadError}</p>
              </div>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  kpis={kpis}
                  currentUser={currentUser}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  recentMovements={movements}
                  inventoryItems={inventoryItems}
                  onOpenNewMovement={handleOpenNewMovement}
                  onOpenVoiceModal={() => guardAuditor(() => setIsVoiceModalOpen(true))}
                  onSelectMovement={(mov) => setSelectedMovementForDetail(mov)}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onOpenSalidaForItem={handleOpenSalidaForItem}
                  onOpenDiagramModal={(item) => handleOpenDiagramModal(item)}
                />
              )}

              {activeTab === 'inventario' && (
                <InventoryView
                  items={inventoryItems}
                  onOpenSalidaForItem={handleOpenSalidaForItem}
                  onOpenDiagramModal={(item) => handleOpenDiagramModal(item)}
                  onOpenEntrada={() => handleOpenNewMovement('Entrada')}
                  onDeleteReference={handleDeleteInventoryReference}
                  onDataChanged={loadData}
                  isAdmin={currentUser.rol === 'admin'}
                  searchTerm={searchQuery}
                  setSearchTerm={setSearchQuery}
                />
              )}

              {activeTab === 'movimientos' && (
                <MovementsHistoryView
                  movements={movements}
                  onSelectMovement={(mov) => setSelectedMovementForDetail(mov)}
                  onDeleteMovement={handleDeleteMovement}
                  onOpenNewMovement={handleOpenNewMovement}
                  currentUserRol={currentUser.rol}
                />
              )}
            </>
          )}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3.5 sm:py-4 text-xs text-slate-500 dark:text-slate-400 text-center mt-auto hidden lg:block transition-colors">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© {new Date().getFullYear()} Sedimec S.A. — Sistema Empresarial de Recepción, Entrega y Trazabilidad de Inventario.</p>
            <div className="flex items-center gap-3 font-semibold text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setIsOnboardingOpen(true)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold cursor-pointer underline"
              >
                Guía de Usuario
              </button>
              <span>•</span>
              <span>RLS + RBAC Reforzado por Supabase</span>
              <span>•</span>
              <span>Gemini AI Speech & Vision</span>
            </div>
          </div>
        </footer>
      </div>

      {/* 3. Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalStock={totalStock}
        lowStockCount={lowStockCount}
        currentUser={currentUser}
        onToggleMobileMenu={() => setIsMobileSidebarOpen((prev) => !prev)}
        onOpenNewMovement={handleOpenNewMovement}
        onOpenVoiceModal={() => guardAuditor(() => setIsVoiceModalOpen(true))}
        onOpenThresholdsModal={() => setIsThresholdsModalOpen(true)}
        onOpenDiagramGenerator={() => {
          setDiagramPieceInfo({
            tipoEquipo: 'Estructura Metálica',
            claseEquipo: 'Viga IPE 300 Estructural',
            ancho: 15,
            largo: 600,
            profundidad: 30,
            estadoEquipo: 'Bueno',
          });
          setIsDiagramModalOpen(true);
        }}
      />

      {/* Floating Re-Open Sidebar Button when hidden on Desktop */}
      {!isSidebarVisible && (
        <button
          id="floating-btn-open-sidebar"
          onClick={() => setIsSidebarVisible(true)}
          title="Mostrar menú lateral"
          className="fixed bottom-6 left-6 z-40 hidden lg:flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 text-amber-400 hover:text-white border border-slate-700 hover:border-amber-400 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs font-bold cursor-pointer group animate-in fade-in slide-in-from-left-4 duration-200"
        >
          <PanelLeftOpen className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span>Mostrar Menú Lateral</span>
        </button>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 max-w-[90vw] sm:max-w-md ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
              : 'bg-rose-950 text-rose-100 border-rose-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span className="flex-1">{toastMessage.message}</span>
        </div>
      )}

      {/* MODALS */}

      <MovementFormModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSubmit={handleCreateMovement}
        initialTipo={movementModalTipo}
        initialItem={movementModalInitialItem}
        initialParsedVoice={movementModalInitialParsedVoice}
        inventoryItems={inventoryItems}
        onOpenVoiceModal={() => {
          setIsMovementModalOpen(false);
          setIsVoiceModalOpen(true);
        }}
        onOpenDiagramGenerator={(info) => handleOpenDiagramModal(info)}
      />

      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onReviewInForm={handleVoiceReviewInForm}
      />

      <PieceDiagramGeneratorModal
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
        pieceInfo={diagramPieceInfo}
      />

      <MovementDetailModal
        movement={selectedMovementForDetail}
        onClose={() => setSelectedMovementForDetail(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
      />

      <StockThresholdsModal
        isOpen={isThresholdsModalOpen}
        onClose={() => setIsThresholdsModalOpen(false)}
        currentUser={currentUser}
        inventoryItems={inventoryItems}
        onThresholdsUpdated={loadData}
      />

      <IntegrityCheckModal
        isOpen={isIntegrityModalOpen}
        onClose={() => setIsIntegrityModalOpen(false)}
        currentUser={currentUser}
        onDataReconciled={loadData}
        showToast={showToast}
      />

      <UserManagementModal
        isOpen={isUserManagementModalOpen}
        onClose={() => setIsUserManagementModalOpen(false)}
        currentUser={currentUser}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onOpenVoiceAssistant={() => guardAuditor(() => setIsVoiceModalOpen(true))}
        onOpenIntegrityCheck={() => setIsIntegrityModalOpen(true)}
        onNavigateToInventory={() => setActiveTab('inventario')}
        onOpenThresholdsModal={() => setIsThresholdsModalOpen(true)}
      />

      <ConversationalAgentWidget
        onNavigateToTab={(tab) => setActiveTab(tab)}
        onOpenVoiceMovementModal={() => guardAuditor(() => setIsVoiceModalOpen(true))}
        onOpenThresholdsModal={() => setIsThresholdsModalOpen(true)}
        onOpenNewMovement={(tipo) => handleOpenNewMovement(tipo)}
      />
    </div>
  );
}
