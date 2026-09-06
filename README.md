# Sedimec — Control de Inventario, Entradas y Salidas

Sistema empresarial de control de patio e inventario para **Sedimec S.A.** (metalmecánica): digitaliza la recepción y entrega de piezas estructurales, calcula existencias en tiempo real a partir del libro de movimientos, gestiona umbrales de stock con alertas por correo, audita la integridad del inventario, y permite registrar movimientos por voz con ayuda de IA.

La base de datos (PostgreSQL vía Supabase) es la única fuente de verdad. El saldo de cada referencia se calcula siempre como `Entradas − Salidas` sobre el historial completo de movimientos — nunca se guarda como un número editable aparte, así que no puede desincronizarse.

---

## Funcionalidades

- **Entradas y Salidas**: registro de recepción/despacho de piezas con dimensiones (cm), cantidad, procedencia/destino, responsable y estado del equipo.
- **Inventario en tiempo real**: saldo, cubicaje (m³) y estado de cada referencia, calculado desde el libro de movimientos.
- **Historial y trazabilidad**: cada movimiento queda con código de lote consecutivo, comprobante imprimible, y quién lo registró. Los movimientos nunca se borran físicamente, solo se anulan (soft-delete) para preservar la auditoría.
- **Umbrales y alertas de stock**: umbral mínimo configurable por referencia; al cruzarlo se dispara una alerta automática por correo (Resend o SMTP).
- **Auditoría de integridad**: motor de 6 reglas que verifica el libro de movimientos (balance de saldos, continuidad cronológica, unicidad de lotes, completitud de datos) y una conciliación de 1 clic.
- **Asistente por voz e IA conversacional**: dicta un movimiento en español natural y la IA (Gemini) lo transcribe, interpreta y prellena el formulario para tu revisión antes de guardar — nunca escribe directo al inventario sin confirmación humana. Incluye chat de consulta sobre el estado del inventario y generación de planos técnicos de piezas.
- **Exportación a Excel/CSV**: del historial de movimientos y del inventario consolidado.
- **Gestión de usuarios y roles**: el Administrador crea usuarios y asigna rol directamente desde la aplicación — sin tocar el dashboard de Supabase.
- **Control de acceso por rol (RBAC)**: `admin` (control total), `operador` (registra movimientos), `auditor` (solo lectura) — reforzado en la base de datos (RLS), no solo en la interfaz.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite (SPA estática, sin servidor Node) |
| Estilos | Tailwind CSS |
| Backend | [Supabase](https://supabase.com) (plan gratuito) — PostgreSQL, Auth (GoTrue), Row Level Security, Storage |
| Lógica de servidor | Supabase Edge Functions (Deno) |
| IA | Google Gemini (voz, chat, generación de imágenes), con fallback local por reglas si no hay API key |
| Correo | Resend (HTTP) o SMTP propio, con modo "Simulado" por defecto |
| Testing | Vitest — unitarias, y de integración contra la base de datos real (sin mocks para reglas de negocio) |
| Excel/CSV | [SheetJS (xlsx)](https://sheetjs.com) |

### Estructura del proyecto

```
src/
├── components/       Componentes de React (una vista/modal por archivo)
├── services/api.ts   Única capa de acceso a datos -- supabase-js (tablas, RPC, Edge Functions)
├── lib/               Cliente de Supabase
├── types.ts           Contrato de datos del dominio
└── utils/             Exportación Excel/CSV, audio

supabase/
├── schema_completo.sql   Script único: tablas, RLS, triggers, vistas y funciones (para pegar en el SQL Editor)
├── migrations/            Las mismas migraciones, una por archivo (control de versiones)
├── functions/             Edge Functions (Deno): IA, correo, gestión de usuarios
└── seed.sql               Datos de ejemplo opcionales

scripts/    Scripts puntuales de administración (crear usuarios demo, etc.)
```

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
   - Solo debes correrlo **una vez** sobre un proyecto nuevo.

## 3. Crear el primer Administrador

RLS exige un usuario autenticado real. Solo necesitas crear **uno** manualmente; desde ahí, el resto de administradores/auditores se crean desde **Gestión de Usuarios** en el menú lateral (requiere estar logueado como admin). Los operadores también pueden autorregistrarse desde la pantalla de login ("Regístrate aquí") — ver la limitación de correo en la sección [Limitaciones conocidas](#limitaciones-conocidas) antes de habilitar esto para usuarios reales.

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
npx supabase functions deploy request-access
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
> Estos secrets **no** controlan el correo de confirmación de cuenta (ver [Limitaciones conocidas](#limitaciones-conocidas)) — ese es un sistema aparte, propio de Supabase Auth.

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
      generate-diagram-image · send-stock-alert-email · admin-create-user · admin-delete-user
```

Puntos clave del diseño (ver `supabase/schema_completo.sql` para el detalle):

- **El libro de movimientos es la única fuente de verdad.** El inventario (`inventario_actual`) es una vista SQL que siempre se recalcula desde los movimientos — nunca puede desincronizarse. El frontend nunca recalcula esta regla por su cuenta; siempre lee el campo ya calculado.
- **El rol del usuario lo resuelve el servidor** (tabla `profiles` + `auth.uid()`), nunca un valor que declare el cliente. Row Level Security aplica las reglas de negocio (admin/operador/auditor) directamente en Postgres, verificado con tests automatizados de RBAC.
- **Los movimientos nunca se borran físicamente** — se anulan (soft-delete con `anulado_por`/`anulado_en`/`motivo_anulacion`) para preservar la trazabilidad de auditoría. Al eliminar un usuario, su historial se conserva (el nombre y rol quedan sellados como snapshot inmutable en cada movimiento).
- **Las funciones de IA viven en Edge Functions**, el único lugar donde existe `GEMINI_API_KEY`. Cada una conserva su fallback local (parser por reglas, motor de chat local, síntesis de voz nativa del navegador) para que la app nunca deje de funcionar sin la key. La IA nunca escribe directo al inventario: siempre pasa por transcripción → extracción estructurada → revisión humana en el formulario → confirmación → persistencia.

---

## Solicitudes de acceso y Portal de Administración

El autorregistro desde el login **ya no depende del correo de Supabase** (su remitente gratuito tiene un límite de envío muy bajo, pensado solo para pruebas). Ahora funciona así:

1. Un visitante hace clic en "Regístrate aquí" en el login y completa nombre, correo y contraseña.
2. Esto llama a la Edge Function pública `request-access`, que crea la cuenta ya confirmada (sin enviar correo) pero en estado **`pendiente`** — no puede iniciar sesión todavía.
3. Un Administrador entra a **Administración** (enlace en el menú lateral, se abre en `/admin` con su propio login) o a **Gestión de Usuarios**, ve la solicitud en la sección "Solicitudes de Acceso Pendientes", elige su rol y hace clic en **Aprobar** (o **Rechazar**, que elimina la cuenta).
4. Aprobada la cuenta, el usuario ya puede iniciar sesión con normalidad.

Esto se refuerza en la base de datos, no solo en la UI: `get_user_role()` únicamente devuelve un rol para cuentas con `estado = 'aprobado'`, y todas las políticas RLS de lectura exigen ese rol -- una cuenta pendiente no puede leer ni escribir nada aunque tenga una sesión válida.

`/admin` es una pantalla completamente separada de la aplicación operativa (propio login, aunque comparte la misma sesión de Supabase), pensada para que la administración del sistema no viva mezclada con el uso diario del inventario.

---

## Desarrollo asistido por IA

Este proyecto incluye un motor agéntico (`CLAUDE.md`, `.claude/`, `.agents/`) con comandos, agentes especializados y skills para seguir desarrollando con Claude Code, Gemini u otros asistentes de IA. Comandos útiles:

- `/primer` — resumen ejecutivo del proyecto para retomar contexto rápido.
- `/generar-prp` y `/ejecutar-prp` — metodología de Propuesta de Requerimientos de Producto para features nuevas.
- `/explorador` — mapa del código y dependencias.

Consulta `CLAUDE.md` para las convenciones y el protocolo completo.
