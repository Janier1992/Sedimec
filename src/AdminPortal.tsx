import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, Mail, Lock, AlertCircle, LogIn, Sun, Moon, ArrowLeft } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { useTheme } from './context/ThemeContext';
import { UserProfile } from './types';
import { AdminUsersPanel } from './components/AdminUsersPanel';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

export default function AdminPortal() {
  const { isDark, toggleTheme } = useTheme();

  const [session, setSession] = useState<Session>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setProfileError(null);
      return;
    }
    supabase
      .from('profiles')
      .select('id, nombre, email, rol, cargo, avatar_url, estado')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setProfileError('No se pudo cargar tu perfil. Vuelve a iniciar sesión.');
          return;
        }
        setProfileError(null);
        setCurrentUser({
          id: data.id,
          nombre: data.nombre,
          email: data.email,
          rol: data.rol,
          cargo: data.cargo,
          avatarUrl: data.avatar_url,
          estado: data.estado,
        });
      });
  }, [session?.user?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'No se pudo iniciar sesión. Verifica tus credenciales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const ThemeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      aria-label={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
    >
      {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
    </button>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Sin sesión: login propio del portal ──
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">{ThemeToggle}</div>
        <div className="max-w-sm w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Portal de Administración</h1>
              <p className="text-xs text-slate-400">Sedimec -- acceso restringido</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="p-6 space-y-3">
            {loginError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Correo electrónico</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sedimec.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Ingresando...' : 'Ingresar'}</span>
            </button>
            <a
              href="/"
              className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 pt-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver a la aplicación
            </a>
          </form>
        </div>
      </div>
    );
  }

  // ── Con sesión, pero el perfil no cargó o no es Administrador aprobado ──
  if (profileError || !currentUser || currentUser.rol !== 'admin' || currentUser.estado !== 'aprobado') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">{ThemeToggle}</div>
        <div className="max-w-sm w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
          <div className="p-3 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-2xl inline-flex mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Acceso restringido</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {profileError || 'Esta área es exclusiva para cuentas con rol Administrador aprobado.'}
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
          <a href="/" className="block text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
            Volver a la aplicación
          </a>
        </div>
      </div>
    );
  }

  // ── Portal ──
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Portal de Administración</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.nombre} · Administrador</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ThemeToggle}
            <button
              onClick={handleLogout}
              className="p-2 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-400 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <AdminUsersPanel currentUser={currentUser} />
        </div>

        <a href="/" className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 pb-4">
          <ArrowLeft className="h-3 w-3" />
          Volver a la aplicación operativa
        </a>
      </div>
    </div>
  );
}
