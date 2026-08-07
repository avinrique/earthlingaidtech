/**
 * New-lead notification email.
 *
 * Deliberately behind a one-function interface. GoDaddy SMTP from a serverless function is the
 * least reliable link in this whole chain — if it starts timing out, swapping the transport for an
 * HTTP email API (Resend, Postmark) means rewriting `send` and nothing else.
 */

import nodemailer from 'nodemailer';

import { env } from './env.js';
import type { LeadInput } from './validate.js';

const transport = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: { user: env.smtp.user, pass: env.smtp.pass },
  // A hung SMTP handshake must not hold a function open until the platform kills it.
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000,
});

/**
 * Escape for HTML. Every lead field is attacker-controlled and lands inside an HTML email body,
 * so none of it may be interpolated raw.
 */
function esc(value: string | null): string {
  if (!value) return '—';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: string | null): string {
  return `<tr>
    <td style="padding:8px 16px 8px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:8px 0;color:#111827;font-size:14px">${esc(value)}</td>
  </tr>`;
}

export interface NotifyResult {
  sent: boolean;
  error?: string;
}

/**
 * Never throws. A failed notification must not fail the request — the lead is already committed to
 * the database by the time this runs, and losing the email is recoverable while losing the lead is
 * not. The caller logs the reason.
 */
export async function notifyNewLead(id: number, lead: LeadInput): Promise<NotifyResult> {
  const subjectName = lead.name || 'Someone';
  const subjectCompany = lead.company ? ` (${lead.company})` : '';

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px">
    <div style="background:#0b0d10;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="color:#f4f7fb;font-size:16px;font-weight:600">New enquiry</div>
      <div style="color:#4a9eff;font-size:13px;margin-top:2px">earthlingaidtech.com &middot; lead #${id}</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px 24px">
      <table style="border-collapse:collapse;width:100%">
        ${row('Name', lead.name)}
        ${row('Email', lead.email)}
        ${row('Company', lead.company)}
        ${row('Phone', lead.phone)}
        ${row('Service', lead.service)}
        ${row('Budget', lead.budget)}
        ${row('From page', lead.source)}
      </table>
      <div style="margin-top:18px;padding-top:18px;border-top:1px solid #e5e7eb">
        <div style="color:#64748b;font-size:13px;margin-bottom:8px">Message</div>
        <div style="color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(lead.message)}</div>
      </div>
      <div style="margin-top:20px">
        <a href="https://api.earthlingaidtech.com/"
           style="display:inline-block;background:#2e7bd6;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">
          Open the lead dashboard
        </a>
      </div>
    </div>
  </div>`;

  const text = [
    `New enquiry — lead #${id}`,
    '',
    `Name:      ${lead.name}`,
    `Email:     ${lead.email}`,
    `Company:   ${lead.company ?? '—'}`,
    `Phone:     ${lead.phone ?? '—'}`,
    `Service:   ${lead.service ?? '—'}`,
    `Budget:    ${lead.budget ?? '—'}`,
    `From page: ${lead.source ?? '—'}`,
    '',
    'Message:',
    lead.message,
    '',
    'Dashboard: https://api.earthlingaidtech.com/',
  ].join('\n');

  try {
    await transport.sendMail({
      from: env.smtp.from,
      to: env.notifyTo,
      // validateLead() has already stripped CR/LF from name and email, so neither can inject
      // additional headers here.
      subject: `New enquiry — ${subjectName}${subjectCompany}`,
      replyTo: `${subjectName} <${lead.email}>`,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}
