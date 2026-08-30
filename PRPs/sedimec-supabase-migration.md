name: "Migración de Sedimec a backend real en Supabase"
description: |
  Reconstrucción del backend del MVP de Sedimec (prototipo de Google AI Studio) para
  reemplazar el servidor Express en memoria y el RBAC falsificable por Supabase
  (Postgres + Auth + RLS + Edge Functions), preservando el frontend React casi intacto.

status: Completado (implementación local); pendiente de despliegue por el usuario en su
  proyecto Supabase cloud (crear proyecto, correr `supabase/schema_completo.sql`, crear
  usuarios demo, desplegar Edge Functions, pegar credenciales en `.env.local`).

---

## Goal

Sustituir `server.ts` (Express, almacenamiento 100% en memoria, RBAC vía header
`x-user-role` falsificable) por una arquitectura Supabase real y persistente, sin romper
ninguna de las funcionalidades existentes del frontend: registro de movimientos,
inventario derivado, umbrales de stock con alertas por correo, auditoría de integridad
de 6 reglas, y las 5 funcionalidades de IA (voz, chat, generación de diagramas).

## Why

- El prototipo perdía todos los datos al reiniciar el proceso — inviable para un cliente real.
- El rol del usuario se leía de un header que cualquiera podía falsificar desde DevTools — sin seguridad real.
- El cliente pidió explícitamente backend en Supabase (plan gratuito) y conexión directa vía script SQL ejecutado en la nube (sin Docker en este entorno de desarrollo).

## What

### Success Criteria
- [x] Esquema PostgreSQL completo con RLS que hace imposible falsificar el rol desde el cliente.
- [x] `inventario_actual` como vista SQL — el saldo nunca puede desincronizarse del libro de movimientos.
- [x] Las 6 reglas de auditoría de integridad + reconciliación de 1 clic viven en RPC PL/pgSQL.
- [x] Las 5 funciones de IA (voz, chat, diagrama) migradas a Edge Functions, cada una con su fallback local ya existente en el prototipo (parser por reglas, motor de chat local, TTS nativo).
- [x] Alertas de stock bajo por correo (Resend / SMTP / simulado) desde una Edge Function.
- [x] `src/services/api.ts` mantiene las mismas firmas exportadas — cero cambios en 15 de los 17 componentes del frontend.
- [x] Login real con Supabase Auth reemplazando el selector de 3 usuarios demo.
- [x] `npm run lint` (tsc --noEmit) y `npm run build` pasan sin errores.
- [ ] Verificación end-to-end contra un proyecto Supabase cloud real (pendiente: requiere que el usuario cree su proyecto y pegue las credenciales; no se pudo probar contra Postgres real en este entorno — ver sección "Validación" abajo).

## All Needed Context

### Documentación y contexto de partida
```yaml
- file: server.ts (ELIMINADO tras la migración)
  why: Fuente original de toda la lógica de negocio portada — validaciones, RBAC,
       cálculo de inventario, motor de integridad (6 reglas), integraciones Gemini,
       envío de correo con Nodemailer.

- file: src/types.ts
  why: Contrato de datos del frontend (Movimiento, ItemInventario, IntegrityCheckReport,
       etc.) que el nuevo backend debe seguir satisfaciendo exactamente.

- file: src/services/api.ts
  why: Capa de fachada ya existente — se preservaron las firmas de las funciones
       exportadas y solo se reescribió su implementación interna (fetch → supabase-js).

- doc: arquitecto-sistemas (subagente)
  why: Diseño formal de esquema/RLS/RPC/Edge Functions, en
       C:\Users\USER\.claude\plans\kind-hugging-hennessy-agent-a670c820e5c8cd41b.md
```

### Árbol de archivos añadidos
```
supabase/
├── config.toml
├── schema_completo.sql        # ← script único para pegar en el SQL Editor de Supabase cloud
├── seed.sql                   # datos de ejemplo (9 movimientos + umbrales)
├── migrations/
│   ├── 0001_schema.sql        # enum, profiles, movimientos, umbrales_stock,
│   │                          #   alertas_stock_email, notification_settings
│   ├── 0002_view_inventario.sql
│   ├── 0003_rls_and_roles.sql
│   ├── 0004_movimiento_rules.sql   # trigger: codigo_lote, validación saldo negativo, sellado
│   ├── 0005_integrity_engine.sql   # run_integrity_check / reconcile_movimientos / anular_movimiento
│   └── 0006_storage.sql       # bucket "diagramas"
└── functions/
    ├── _shared/{cors,auth,gemini,voiceParser,localChatEngine}.ts
    ├── transcribe-audio/
    ├── parse-movimiento-nlp/
    ├── text-to-speech/
    ├── chat-inventario/
    ├── generate-diagram-image/
    └── send-stock-alert-email/

src/lib/supabaseClient.ts      # NUEVO
src/services/api.ts            # REESCRITO (mismas firmas exportadas)
src/components/AuthModal.tsx   # REESCRITO (login real, ya no selector demo)
src/App.tsx                    # REESCRITO (sesión Supabase, IntegrityCheckModal conectado)
server.ts                      # ELIMINADO
```

### Gotchas y decisiones de diseño
```text
- PostgREST permite alias de columnas en select() ("codigoLote:codigo_lote"), así que
  api.ts recibe las filas ya en camelCase sin necesitar una capa de mapeo manual en la
  mayoría de los casos (se usa igual un mapMovimiento() explícito para tipar el objeto
  anidado creadoPor {id, nombre, rol}).
- El campo `search_vector` (tsvector) requiere el índice GIN y `to_tsvector('spanish', ...)`
  para que la búsqueda de texto del historial de movimientos siga funcionando igual que
  el filtro de substring del prototipo.
- Las Edge Functions corren en Deno: se excluyó supabase/functions del tsconfig.json raíz
  (usa globals `Deno` y specifiers `npm:`/`https:` que rompen el type-check de Node/Vite).
  Se agregó supabase/functions/deno.json solo para la experiencia de edición.
- IntegrityCheckModal.tsx existía en el prototipo pero NUNCA estaba importado/renderizado
  en App.tsx — quedó huérfano. Se conectó al Sidebar y al OnboardingModal como parte de
  esta migración porque las RPC que lo alimentan (run_integrity_check, reconcile_movimientos)
  son precisamente las que se construyeron en esta tarea.
- Las herramientas de demo "Simular Descuadre" y "Restablecer Datos de Fábrica" se
  eliminaron: dependían de mutar arrays en memoria del servidor Express y no tienen
  sentido con datos persistidos reales; documentado en README.md.
```

## Implementation Blueprint

### Modelo de datos (resumen — ver supabase/schema_completo.sql para el DDL completo)
- `profiles` (1:1 con `auth.users`, enum `user_role`), alta automática vía trigger `handle_new_user` (siempre `operador`; el admin se promueve manualmente).
- `movimientos`: libro mayor con columnas normalizadas generadas (`*_norm`) para agrupar de forma consistente, `search_vector` para búsqueda, y soft-delete de auditoría (`anulado`/`anulado_por`/`anulado_en`/`motivo_anulacion`) en vez de DELETE físico.
- `inventario_actual`: VIEW (no materializada, `security_invoker`) que agrega `movimientos` — imposible que se desincronice.
- `umbrales_stock`, `alertas_stock_email`, `notification_settings` (singleton).

### Tareas (orden de ejecución real)
```yaml
Task 1 — Esquema y RLS:
  CREATE supabase/migrations/0001_schema.sql .. 0006_storage.sql
  CONCATENATE en supabase/schema_completo.sql para entrega directa al usuario

Task 2 — Motor de integridad:
  PORT server.ts:1160-1429 (6 reglas) → run_integrity_check() PL/pgSQL
  PORT server.ts:825-858 (anulación con validación de saldo) → anular_movimiento()
  NUEVO reconcile_movimientos() con window functions (transacción atómica)

Task 3 — Edge Functions:
  PORT server.ts:1817-2172 (5 endpoints de IA) → 5 Edge Functions Deno
  PORT dispatchStockAlertEmail (server.ts:189-301) → send-stock-alert-email
    (Nodemailer → Resend HTTP API primario, denomailer/SMTP alternativo, simulado default)

Task 4 — Frontend:
  MODIFY src/services/api.ts: mismas firmas exportadas, internals → supabase-js
  CREATE src/lib/supabaseClient.ts
  REWRITE src/components/AuthModal.tsx: login real
  REWRITE src/App.tsx: sesión Supabase, conectar IntegrityCheckModal
  EDIT IntegrityCheckModal.tsx / StockThresholdsModal.tsx: quitar parámetros userRole
  DELETE server.ts; MODIFY package.json (SPA estático puro, +@supabase/supabase-js)

Task 5 — Validación y documentación:
  RUN tsc --noEmit, vite build (✅ ambos pasan)
  WRITE README.md con guía de puesta en marcha paso a paso
```

## Validation Loop

### Nivel 1: Sintaxis y tipos
```bash
npm run lint    # tsc --noEmit — PASA
npm run build   # vite build — PASA (2487 módulos, sin errores)
```

### Nivel 2: Integración (limitado por el entorno)
El usuario pidió explícitamente **no usar Docker** en este entorno, por lo que no fue
posible levantar un stack Supabase local para probar las migraciones/RLS/Edge Functions
contra una base de datos real antes de la entrega. La validación de la capa de datos se
hizo por **revisión manual exhaustiva** del SQL (tipos, límites de FK, orden de
dependencias entre migraciones, sintaxis de window functions y jsonb_build_object).

**Pendiente por parte del usuario** (documentado en README.md paso a paso):
1. Correr `supabase/schema_completo.sql` en el SQL Editor de un proyecto Supabase real.
2. Crear los 3 usuarios demo y promover roles.
3. `supabase functions deploy` de las 6 funciones + `supabase secrets set`.
4. Pegar `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` en `.env.local`.
5. Probar el flujo completo: login, crear Entrada/Salida, verificar bloqueo de saldo
   negativo, umbrales, auditoría de integridad, y que el rol `auditor` no pueda escribir.

Si algún paso del script SQL falla, el mensaje de error de Postgres debe reportarse
literalmente para poder corregirlo con precisión.

## Anti-Patterns evitados
- ❌ No se guardó el volumen (m³) como columna — se calcula siempre en la vista, eliminando una clase entera de bugs de desincronización que existía en el prototipo.
- ❌ No se confía en ningún valor de rol que declare el cliente (ni header, ni body, ni JWT sin verificar) — todo pasa por `get_user_role()` vía `auth.uid()`.
- ❌ No se implementó DELETE físico de movimientos — todo el ciclo de vida de auditoría exige soft-delete.
