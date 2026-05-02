// src/app/api/admin/incident-alert/route.ts
// Endpoint per enviar alertes d'incidents crítics per email

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { requireSuperAdminRequest } from '@/lib/api/request-guards';
import { escapeHtml } from '@/lib/security/html';

interface IncidentAlertRequest {
  incidentId: string;
  title: string;
  type: string;
  severity: string;
  impact: string;
  route?: string;
  message: string;
  count: number;
}

const ADMIN_EMAIL = 'raul.vico.ferre@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperAdminRequest(request);
    if (!guard.ok) {
      return NextResponse.json({ sent: false, error: guard.message }, { status: guard.status });
    }

    const rateLimit = checkRateLimit({
      key: `admin:incident-alert:${guard.auth.uid}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { sent: false, error: 'Rate limited. Espera uns segons.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body: IncidentAlertRequest = await request.json();

    const { incidentId, title, type, severity, impact, route, message, count } = body;

    // Només enviar si és "blocker"
    if (impact !== 'blocker') {
      return NextResponse.json({ sent: false, reason: 'Only blocker impacts trigger alerts' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error('[IncidentAlert] RESEND_API_KEY not configured');
      return NextResponse.json({ sent: false, reason: 'Email service not configured' }, { status: 500 });
    }

    // Construir email
    const safeTitle = String(title ?? '').slice(0, 120);
    const safeType = String(type ?? '').slice(0, 80);
    const safeSeverity = String(severity ?? '').slice(0, 40);
    const rawMessage = String(message ?? '');
    const safeMessage = rawMessage.slice(0, 500);
    const safeRoute = route ? String(route).slice(0, 200) : 'N/A';
    const safeCount = Number.isFinite(count) ? count : 0;
    const subject = `[ALERTA] Incident crític a Summa Social: ${safeTitle}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #dc2626; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 20px; }
    .field { margin-bottom: 12px; }
    .label { font-weight: 600; color: #374151; }
    .value { color: #6b7280; }
    .message { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 12px; margin: 16px 0; }
    .message pre { margin: 0; white-space: pre-wrap; font-size: 13px; color: #991b1b; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
    .footer { padding: 16px 20px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Incident Crític Detectat</h1>
    </div>
    <div class="content">
      <div class="field">
        <span class="label">Tipus:</span>
        <span class="value">${escapeHtml(safeType)}</span>
      </div>
      <div class="field">
        <span class="label">Severitat:</span>
        <span class="value">${escapeHtml(safeSeverity)}</span>
      </div>
      <div class="field">
        <span class="label">Impacte:</span>
        <span class="value" style="color: #dc2626; font-weight: bold;">BLOQUEJA</span>
      </div>
      <div class="field">
        <span class="label">Ruta afectada:</span>
        <span class="value">${escapeHtml(safeRoute)}</span>
      </div>
      <div class="field">
        <span class="label">Repeticions:</span>
        <span class="value">${escapeHtml(safeCount)}</span>
      </div>

      <div class="message">
        <pre>${escapeHtml(safeMessage)}${rawMessage.length > 500 ? '...' : ''}</pre>
      </div>

      <a href="https://summasocial.app/admin#salut" class="button">
        Veure incident al panell
      </a>
    </div>
    <div class="footer">
      Summa Social - Alerta automàtica d'incidents
    </div>
  </div>
</body>
</html>
    `;

    const text = `
INCIDENT CRÍTIC - SUMMA SOCIAL

Tipus: ${safeType}
Severitat: ${safeSeverity}
Impacte: BLOQUEJA
Ruta: ${safeRoute}
Repeticions: ${safeCount}

Missatge:
${safeMessage}

---
Veure incident: https://summasocial.app/admin#salut
    `.trim();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Summa Social Alertes <alertes@summasocial.app>',
        to: ADMIN_EMAIL,
        subject,
        html,
        text,
      }),
    });

    if (response.ok) {
      console.info(`[IncidentAlert] Email sent for incident ${incidentId}`);
      return NextResponse.json({ sent: true, to: ADMIN_EMAIL });
    } else {
      const errorData = await response.json();
      console.error('[IncidentAlert] Resend error:', errorData);
      return NextResponse.json({ sent: false, error: errorData }, { status: 500 });
    }
  } catch (error) {
    console.error('[IncidentAlert] Error:', error);
    return NextResponse.json({ sent: false, error: 'Internal server error' }, { status: 500 });
  }
}
