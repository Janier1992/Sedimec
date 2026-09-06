import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

// Portal de Administración separado: /admin tiene su propio login y vista,
// independiente de la aplicación operativa (misma sesión de Supabase, solo
// una entrada de UI distinta). Se separa en su propio chunk -- quien visita
// "/" nunca descarga el código del portal, y viceversa.
const isAdminPortal = window.location.pathname.startsWith('/admin');

const App = lazy(() => import('./App.tsx'));
const AdminPortal = lazy(() => import('./AdminPortal.tsx'));

const FullScreenSpinner = (
  <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Suspense fallback={FullScreenSpinner}>
        {isAdminPortal ? <AdminPortal /> : <App />}
      </Suspense>
    </ThemeProvider>
  </StrictMode>,
);
