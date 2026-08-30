import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";

interface AlertPayload {
  tipoEquipo: string;
  claseEquipo: string;
  saldoActual: number;
  umbralConfigurado: number;
  destinatario?: string;
  responsable?: string;
  procedenciaDestino?: string;
  dimensiones?: string;
  movimientoId?: string;
}

function buildHtml(p: AlertPayload, isEmergency: boolean, senderLabel: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px 24px; color: #0f172a;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 900;">SEDIMEC S.A.</h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">${senderLabel}</p>
      </div>
      <div style="padding: 24px;">
        <div style="background-color: ${isEmergency ? "#450a0a" : "#451a03"}; border: 1px solid ${isEmergency ? "#991b1b" : "#b45309"}; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: ${isEmergency ? "#fca5a5" : "#fcd34d"};">
            ${isEmergency ? "⛔ ALERTA CRÍTICA: Stock completamente agotado" : "⚠️ Notificación de existencias por debajo del umbral mínimo"}
          </p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 8px 0; color: #94a3b8;">Pieza / Clase:</td><td style="padding: 8px 0; color: #fff; font-weight: 800; text-align: right;">${p.claseEquipo}</td></tr>
          <tr><td style="padding: 8px 0; color: #94a3b8;">Categoría:</td><td style="padding: 8px 0; color: #e2e8f0; text-align: right;">${p.tipoEquipo}</td></tr>
          ${p.dimensiones ? `<tr><td style="padding: 8px 0; color: #94a3b8;">Dimensiones:</td><td style="padding: 8px 0; color: #e2e8f0; text-align: right;">${p.dimensiones}</td></tr>` : ""}
          <tr><td style="padding: 8px 0; color: #94a3b8;">Saldo Actual:</td><td style="padding: 8px 0; color: ${isEmergency ? "#ef4444" : "#f59e0b"}; font-weight: 900; text-align: right;">${p.saldoActual} unidades</td></tr>
          <tr><td style="padding: 8px 0; color: #94a3b8;">Umbral Mínimo:</td><td style="padding: 8px 0; color: #cbd5e1; text-align: right;">${p.umbralConfigurado} unidades</td></tr>
          ${p.responsable ? `<tr><td style="padding: 8px 0; color: #94a3b8;">Último Responsable:</td><td style="padding: 8px 0; color: #e2e8f0; text-align: right;">${p.responsable}</td></tr>` : ""}
          ${p.procedenciaDestino ? `<tr><td style="padding: 8px 0; color: #94a3b8;">Destino / Procedencia:</td><td style="padding: 8px 0; color: #e2e8f0; text-align: right;">${p.procedenciaDestino}</td></tr>` : ""}
        </table>
      </div>
      <div style="background-color: #020617; padding: 14px 24px; font-size: 11px; color: #64748b; text-align: center;">
        Sedimec S.A. • Control de Trazabilidad e Inventario • Generado automáticamente el ${new Date().toLocaleString("es-CO")}
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const caller = await authenticateCaller(req, ["admin", "operador"]);
  if (isAuthError(caller)) return caller;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = (await req.json()) as AlertPayload;
    const { data: settings } = await admin
      .from("notification_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const targetEmail = payload.destinatario || (settings?.recipients ?? []).join(", ") || "director.operaciones@sedimec.com";
    const isEmergency = payload.saldoActual <= 0;
    const subject = isEmergency
      ? `🚨 URGENTE: Stock AGOTADO en Patio - ${payload.claseEquipo} (0 und)`
      : `⚠️ ALERTA DE STOCK BAJO: ${payload.claseEquipo} (${payload.saldoActual} und disponibles)`;

    const senderName = settings?.sender_name || "Sedimec Sistema de Alertas";
    const senderEmail = settings?.sender_email || "alertas-stock@sedimec.com";
    const html = buildHtml(payload, isEmergency, "Sistema Automatizado de Control de Patio y Stock Mínimo");
    const text = `Sedimec Alerta: ${payload.claseEquipo} ha alcanzado un stock de ${payload.saldoActual} unidades (Umbral mínimo: ${payload.umbralConfigurado} unidades).`;

    let estado: "Enviado" | "Simulado" | "Fallido" = "Simulado";
    let mensajeDetallado = `Sin proveedor de correo configurado (RESEND_API_KEY o SMTP_*). Notificación simulada para ${targetEmail}.`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const smtpHost = Deno.env.get("SMTP_HOST");

    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${senderName} <${senderEmail}>`,
            to: targetEmail.split(",").map((e) => e.trim()),
            subject,
            html,
            text,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        estado = "Enviado";
        mensajeDetallado = `Notificación despachada vía Resend a ${targetEmail}.`;
      } catch (err) {
        estado = "Fallido";
        mensajeDetallado = `Error enviando vía Resend: ${(err as Error).message}`;
      }
    } else if (smtpHost) {
      try {
        const client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: Number(Deno.env.get("SMTP_PORT")) || 587,
            tls: Number(Deno.env.get("SMTP_PORT")) === 465,
            auth: { username: Deno.env.get("SMTP_USER") || "", password: Deno.env.get("SMTP_PASS") || "" },
          },
        });
        await client.send({ from: senderEmail, to: targetEmail, subject, html, content: text });
        await client.close();
        estado = "Enviado";
        mensajeDetallado = `Notificación despachada vía SMTP a ${targetEmail}.`;
      } catch (err) {
        estado = "Fallido";
        mensajeDetallado = `Error enviando vía SMTP: ${(err as Error).message}`;
      }
    }

    const { data: inserted, error: insertErr } = await admin
      .from("alertas_stock_email")
      .insert({
        destinatario: targetEmail,
        asunto: subject,
        tipo_equipo: payload.tipoEquipo,
        clase_equipo: payload.claseEquipo,
        saldo_actual: payload.saldoActual,
        umbral_configurado: payload.umbralConfigurado,
        estado,
        mensaje_detallado: mensajeDetallado,
        movimiento_id: payload.movimientoId ?? null,
      })
      // Alias a camelCase: el frontend consume esta fila como `AlertaStockEmail`
      // (src/types.ts), que espera tipoEquipo/claseEquipo/saldoActual/etc.
      .select(
        "id, fecha, destinatario, asunto, tipoEquipo:tipo_equipo, claseEquipo:clase_equipo, " +
          "saldoActual:saldo_actual, umbralConfigurado:umbral_configurado, estado, mensajeDetallado:mensaje_detallado"
      )
      .single();

    if (insertErr) {
      console.error("Error insertando log de alerta:", insertErr);
    }

    return jsonResponse({
      success: true,
      mensaje: `Notificación de alerta procesada (${estado}) para ${targetEmail}.`,
      data: inserted ?? { estado, mensajeDetallado },
    });
  } catch (error) {
    console.error("Error en send-stock-alert-email:", error);
    return jsonResponse({ error: "Error al despachar notificación." }, 500);
  }
});
