import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Trash2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  Briefcase,
  Clock,
  Check,
  X as XIcon,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { fetchUsers, createUser, updateUserRole, deleteUser, approveUserRequest } from '../services/api';

interface AdminUsersPanelProps {
  currentUser: UserProfile;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  operador: 'Operador de Patio',
  auditor: 'Auditor',
};

export const AdminUsersPanel: React.FC<AdminUsersPanelProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [rol, setRol] = useState<UserRole>('operador');

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setUsers(await fetchUsers());
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al cargar usuarios' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNombre('');
    setCargo('');
    setRol('operador');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      setIsSubmitting(true);
      const res = await createUser({ email: email.trim(), password, nombre: nombre.trim(), cargo: cargo.trim(), rol });
      setMessage({ type: 'success', text: res.mensaje });
      resetForm();
      setIsFormOpen(false);
      await loadUsers();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al crear usuario' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (user: UserProfile, newRol: UserRole) => {
    if (user.id === currentUser.id) {
      setMessage({ type: 'error', text: 'No puedes cambiar tu propio rol mientras tienes la sesión activa.' });
      return;
    }
    try {
      await updateUserRole(user.id, newRol);
      setMessage({ type: 'success', text: `Rol de ${user.nombre} actualizado a ${ROLE_LABELS[newRol]}.` });
      await loadUsers();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al cambiar el rol' });
    }
  };

  const handleDelete = async (user: UserProfile) => {
    if (user.id === currentUser.id) {
      setMessage({ type: 'error', text: 'No puedes eliminar tu propia cuenta.' });
      return;
    }
    if (!window.confirm(`¿Eliminar la cuenta de ${user.nombre} (${user.email})? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await deleteUser(user.id);
      setMessage({ type: 'success', text: res.mensaje });
      await loadUsers();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al eliminar usuario' });
    }
  };

  const handleApprove = async (request: UserProfile) => {
    const chosenRol = pendingRoles[request.id] || 'operador';
    try {
      setProcessingRequestId(request.id);
      await approveUserRequest(request.id, chosenRol);
      setMessage({ type: 'success', text: `Acceso aprobado para ${request.nombre} con rol ${ROLE_LABELS[chosenRol]}.` });
      await loadUsers();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al aprobar la solicitud' });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (request: UserProfile) => {
    if (!window.confirm(`¿Rechazar y eliminar la solicitud de ${request.nombre} (${request.email})?`)) return;
    try {
      setProcessingRequestId(request.id);
      const res = await deleteUser(request.id);
      setMessage({ type: 'success', text: res.mensaje });
      await loadUsers();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al rechazar la solicitud' });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const solicitudes = users.filter((u) => u.estado === 'pendiente');
  const activos = users.filter((u) => u.estado !== 'pendiente');

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Solicitudes de acceso pendientes */}
      {solicitudes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Solicitudes de Acceso Pendientes ({solicitudes.length})
          </h3>
          <div className="space-y-2">
            {solicitudes.map((req) => (
              <div key={req.id} className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{req.nombre}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{req.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={pendingRoles[req.id] || 'operador'}
                    onChange={(e) => setPendingRoles((prev) => ({ ...prev, [req.id]: e.target.value as UserRole }))}
                    className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="operador">Operador</option>
                    <option value="auditor">Auditor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={processingRequestId === req.id}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg cursor-pointer"
                    title="Aprobar acceso"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={processingRequestId === req.id}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 disabled:opacity-50 text-rose-600 rounded-lg cursor-pointer"
                    title="Rechazar solicitud"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón / formulario de creación */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Agregar Usuario Directamente
        </h3>
        {!isFormOpen && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Crea la cuenta con acceso inmediato (Operador, Auditor o Administrador), sin pasar por una solicitud.
          </p>
        )}
        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Crear Nuevo Usuario</span>
          </button>
        )}
      </div>
      {isFormOpen && (
        <form onSubmit={handleCreate} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre completo</label>
              <input
                type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="ej: Andrés Morales"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Cargo</label>
              <div className="relative">
                <Briefcase className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text" value={cargo} onChange={(e) => setCargo(e.target.value)}
                  placeholder="ej: Operador de Patio"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Correo electrónico</label>
              <div className="relative">
                <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@sedimec.com"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña (mín. 8 caracteres)</label>
              <div className="relative">
                <Lock className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Rol / Permisos</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="operador">Operador de Patio (crea movimientos)</option>
              <option value="auditor">Auditor (solo lectura)</option>
              <option value="admin">Administrador (control total)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setIsFormOpen(false); resetForm(); }}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Creando...' : 'Crear Usuario'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Listado de usuarios activos */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Usuarios Activos ({activos.length})
        </h3>
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">Cargando usuarios...</div>
        ) : (
          <div className="space-y-2">
            {activos.map((u) => (
              <div key={u.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs ${
                      u.rol === 'admin' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200' : u.rol === 'operador' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200' : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200'
                    }`}
                  >
                    {u.nombre.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {u.nombre}
                      {u.id === currentUser.id && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full font-semibold">Tú</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={u.rol}
                    disabled={u.id === currentUser.id}
                    onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                    title={u.id === currentUser.id ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                    className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <option value="operador">Operador</option>
                    <option value="auditor">Auditor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={u.id === currentUser.id}
                    title={u.id === currentUser.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed text-rose-600 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
        <span>Los roles se refuerzan directamente en la base de datos (Row Level Security) -- un usuario nunca puede darse permisos ni aprobarse el acceso a sí mismo.</span>
      </div>
    </div>
  );
};
