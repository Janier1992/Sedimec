# Sedimec — Control de Inventario, Entradas y Salidas

Sistema empresarial para Sedimec S.A. (metalmecánica): recepción y entrega de piezas estructurales, cálculo de existencias en tiempo real, umbrales de stock con alertas por correo, auditoría de integridad de inventario y un asistente de voz/chat con IA (Gemini).

- **Frontend**: React 19 + Vite + Tailwind (SPA estática, sin servidor Node).
- **Backend**: [Supabase](https://supabase.com) (plan gratuito) — PostgreSQL + Auth + Row Level Security + Edge Functions.

---

## 1. Crear el proyecto Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y crea un **New Project** (plan gratuito).
2. Anota la contraseña de la base de datos que definas — la necesitarás para el CLI.
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key

## 2. Ejecutar el script de base de datos

1. Abre **SQL Editor → New query** en el dashboard de tu proyecto.
2. Pega **todo** el contenido de [`supabase/schema_completo.sql`](supabase/schema_completo.sql) y presiona **Run**.
   - Este único script crea las tablas (`profiles`, `movimientos`, `umbrales_stock`, `alertas_stock_email`, `notification_settings`), la vista `inventario_actual`, las políticas RLS, los triggers de negocio y las funciones de auditoría (`run_integrity_check`, `reconcile_movimientos`, `anular_movimiento`), además del bucket de Storage para los diagramas técnicos.
   - Es idempotente en el sentido de que solo debes correrlo **una vez** sobre un proyecto nuevo.

## 3. Crear el primer Administrador

RLS exige un usuario autenticado real. Solo necesitas crear **uno** manualmente; desde ahí, el resto de usuarios (operadores, auditores, otros administradores) se crean directamente en la aplicación desde **Gestión de Usuarios** en el menú lateral (requiere estar logueado como admin).

1. Ve a **Authentication → Users → Add user**, crea tu cuenta (marca **Auto Confirm User**).
2. Todo usuario nuevo nace con rol `operador` por defecto. Promuévete a administrador en el **SQL Editor**:

```sql
update public.profiles set rol = 'admin' where email = 'tu-correo@ejemplo.com';
```

3. (Opcional, solo para tener datos de ejemplo) Corre [`supabase/seed.sql`](supabase/seed.sql) en el SQL Editor **después** de crear tu usuario y al menos un operador (el script asigna los movimientos a esas cuentas).

## 4. Desplegar las Edge Functions (funciones de IA y correo)

Necesitas el [Supabase CLI](https://supabase.com/docs/guides/cli) instalado (`npm i -g supabase` o `npx supabase`).

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF   # está en la URL del dashboard
npx supabase functions deploy transcribe-audio
npx supabase functions deploy parse-movimiento-nlp
npx supabase functions deploy text-to-speech
npx supabase functions deploy chat-inventario
npx supabase functions deploy generate-diagram-image
npx supabase functions deploy send-stock-alert-email
npx supabase functions deploy admin-create-user
npx supabase functions deploy admin-delete-user
```

Luego configura los secrets (nunca van en el `.env` del cliente, solo aquí):

```bash
npx supabase secrets set GEMINI_API_KEY=tu_api_key_de_gemini
# Correo: elige UNA de las dos opciones (o ninguna, y las alertas quedarán "Simuladas")
npx supabase secrets set RESEND_API_KEY=tu_api_key_de_resend
# — o —
npx supabase secrets set SMTP_HOST=smtp.tuproveedor.com SMTP_PORT=587 SMTP_USER=usuario SMTP_PASS=clave
```

> Sin `GEMINI_API_KEY`, el dictado por voz usa un parser por reglas en español y el chat usa un motor de respuestas local — la app sigue siendo 100% funcional, solo sin IA generativa.
> Sin `RESEND_API_KEY` ni `SMTP_*`, las alertas de stock bajo quedan registradas como "Simulado" en vez de enviarse de verdad.

## 5. Configurar el frontend

```bash
cp .env.example .env.local
```

Edita `.env.local` y pega tu `Project URL` y `anon key` del paso 1:

```
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu_anon_key"
```

```bash
npm install
npm run dev       # http://localhost:5173
npm run build      # build de producción en dist/ (sube esta carpeta a cualquier hosting estático)
npm run lint        # tsc --noEmit
npm run test         # vitest — pruebas unitarias + integración
```

Inicia sesión con la cuenta que creaste en el paso 3.

### Pruebas de integración (flujo crítico Entrada → Inventario → Salida)

`src/services/api.criticalFlow.test.ts` prueba las reglas de negocio contra la base de datos real (no mockeada, porque las reglas críticas viven en Postgres). Es opcional: si no defines estas dos variables en `.env.local`, el archivo se omite solo.

```
VITE_TEST_E2E_EMAIL="cuenta-de-pruebas@tu-dominio.com"
VITE_TEST_E2E_PASSWORD="contraseña-de-esa-cuenta"
```

Usa una cuenta dedicada (con rol `admin`, para que el test pueda limpiar lo que crea), nunca tu cuenta real de negocio — créala desde **Gestión de Usuarios**.

### Pruebas de RBAC (control de acceso por rol)

`src/services/api.rbac.test.ts` prueba que admin/operador/auditor tienen exactamente los permisos que deben tener, reforzados por RLS y las funciones RPC (no por la interfaz). Necesita 3 cuentas de prueba dedicadas, una por rol:

```
VITE_TEST_E2E_EMAIL / VITE_TEST_E2E_PASSWORD                     # rol admin
VITE_TEST_E2E_OPERADOR_EMAIL / VITE_TEST_E2E_OPERADOR_PASSWORD   # rol operador
VITE_TEST_E2E_AUDITOR_EMAIL / VITE_TEST_E2E_AUDITOR_PASSWORD     # rol auditor
```

También opcional: si faltan, se omite solo.

---

## Arquitectura

```
React (Vite SPA)
 ├─ supabase-js (JWT de sesión) → PostgREST → Postgres con Row Level Security
 │    tablas: profiles, movimientos, umbrales_stock, alertas_stock_email, notification_settings
 │    view:   inventario_actual   (saldo = Σ Entradas − Σ Salidas, siempre recalculado)
 │    RPC:    run_integrity_check() · reconcile_movimientos() · anular_movimiento()
 └─ supabase-js functions.invoke() → Edge Functions (Deno, secrets del lado servidor)
      transcribe-audio · parse-movimiento-nlp · text-to-speech · chat-inventario ·
      generate-diagram-image · send-stock-alert-email
```

Puntos clave del diseño (ver `supabase/schema_completo.sql` para el detalle):

- **El libro de movimientos es la única fuente de verdad.** El inventario (`inventario_actual`) es una vista SQL que siempre se recalcula desde los movimientos — nunca puede desincronizarse.
- **El rol del usuario lo resuelve el servidor** (tabla `profiles` + `auth.uid()`), nunca un valor que declare el cliente. Row Level Security aplica las reglas de negocio (admin/operador/auditor) directamente en Postgres.
- **Los movimientos nunca se borran físicamente** — se anulan (soft-delete con `anulado_por`/`anulado_en`/`motivo_anulacion`) para preservar la trazabilidad de auditoría.
- **Las funciones de IA viven en Edge Functions**, el único lugar donde existe `GEMINI_API_KEY`. Cada una conserva su fallback local (parser por reglas, motor de chat local, síntesis de voz nativa del navegador) para que la app nunca deje de funcionar sin la key.

### Diferencias frente al prototipo original de AI Studio

- Se eliminó el servidor Express (`server.ts`) y el almacenamiento en memoria — todo es Postgres persistente.
- Se eliminó el selector de "usuario demo" — ahora es login real con Supabase Auth.
- Se eliminaron las herramientas de demo "Simular Descuadre" / "Restablecer Datos de Fábrica", pensadas para datos efímeros en memoria y sin sentido con datos reales persistidos.
- Se agregó al menú lateral el motor de **Auditoría de Integridad** (el componente ya existía en el prototipo pero nunca estaba conectado a la aplicación).

---

## Desarrollo asistido por IA

Este proyecto incluye un motor agéntico (`CLAUDE.md`, `.claude/`, `.agents/`) con comandos, agentes especializados y skills para seguir desarrollando con Claude Code, Gemini u otros asistentes de IA. Comandos útiles:

- `/primer` — resumen ejecutivo del proyecto para retomar contexto rápido.
- `/generar-prp` y `/ejecutar-prp` — metodología de Propuesta de Requerimientos de Producto para features nuevas.
- `/explorador` — mapa del código y dependencias.

Consulta `CLAUDE.md` para las convenciones y el protocolo completo.
