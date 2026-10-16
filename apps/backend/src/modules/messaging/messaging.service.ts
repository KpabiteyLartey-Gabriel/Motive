import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as https from 'https';

export interface SendResult {
  delivered: boolean;
  provider: string;
  detail?: string;
}

/**
 * Direct email (SMTP) and SMS (Arkesel) delivery.
 *
 * Email: uses SMTP_* env vars. Gmail app passwords are pasted with spaces —
 * they are stripped before auth. The From address uses EMAIL_FROM unless the
 * SMTP host is Gmail, where the authenticated account must be the sender.
 *
 * SMS: three supported configurations, in order:
 *   1. SMS_API_KEY containing a whole Arkesel v1 URL template
 *      (https://sms.arkesel.com/sms/api?action=send-sms&api_key=...&to=...&from=...&sms=...)
 *      — the real api_key is extracted and to/sms are replaced per message.
 *   2. ARKESEL_API_KEY (or a plain SMS_API_KEY) with the Arkesel v2 API.
 *   3. SMS_PROVIDER=mock or no key — logged only, reported as not delivered.
 *
 * Sender ID: ARKESEL_SENDER_ID / SMS_SENDER_ID env, default "GHMotive"
 * (the "SenderID" placeholder in a pasted template URL is never used).
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private transporter: nodemailer.Transporter | null = null;

  // ── Email ────────────────────────────────────────────────────

  get emailConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(process.env.SMTP_PORT || 587);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
      },
    });
    return this.transporter;
  }

  private fromAddress(): string {
    const host = (process.env.SMTP_HOST || '').toLowerCase();
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || '';
    // Gmail rejects/rewrites mail whose From is not the account (or a verified alias)
    if (host.includes('gmail') && process.env.SMTP_USER) return `"Positive Motive" <${process.env.SMTP_USER}>`;
    return from.includes('<') ? from : `"Positive Motive" <${from}>`;
  }

  private replyToAddress(): string | undefined {
    // Replies should reach a real mailbox, never a noreply domain address
    return process.env.SMTP_USER || process.env.SUPPORT_EMAIL || undefined;
  }

  private withFooter(body: string, html?: string): { text: string; html: string } {
    const footerText = '\n\n--\nPositive Motive (+Motive) — Ghana\'s transport investment platform\nQuestions? Simply reply to this email and our team will help.\nIf you did not expect this message, you can safely ignore it.';
    const text = body.includes('Positive Motive (+Motive)') ? body : body + footerText;
    const footerHtml = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px"/><p style="color:#6b7280;font-size:12px;line-height:1.6">Positive Motive (+Motive) — Ghana\'s transport investment platform<br/>Questions? Simply reply to this email and our team will help.<br/>If you did not expect this message, you can safely ignore it.</p>';
    const htmlOut = html
      ? (html.includes('</body>') ? html.replace('</body>', `${footerHtml}</body>`) : html + footerHtml)
      : `<p>${text.replace(/\n/g, '<br/>')}</p>`;
    return { text, html: htmlOut };
  }

  async sendEmail(to: string, subject: string, body: string, html?: string): Promise<SendResult> {
    if (!to) return { delivered: false, provider: 'none', detail: 'no recipient' };
    if (!this.emailConfigured) {
      this.logger.warn(`[Email:mock] To: ${to} | ${subject} | ${body.slice(0, 120)}`);
      return { delivered: false, provider: 'mock', detail: 'SMTP not configured' };
    }
    try {
      const content = this.withFooter(body, html);
      const info = await this.getTransporter().sendMail({
        from: this.fromAddress(),
        replyTo: this.replyToAddress(),
        to,
        subject,
        text: content.text,
        html: content.html,
      });
      this.logger.log(`[Email] Sent to ${to}: ${subject} (${info.messageId})`);
      return { delivered: true, provider: 'smtp', detail: info.messageId };
    } catch (err: any) {
      this.logger.error(`[Email] Failed to ${to}: ${err?.message}`);
      return { delivered: false, provider: 'smtp', detail: err?.message };
    }
  }

  // ── SMS (Arkesel) ────────────────────────────────────────────

  private arkeselTemplate(): { apiKey: string } | null {
    const key = (process.env.SMS_API_KEY || '').trim();
    if (!/^https?:\/\//i.test(key)) return null;
    try {
      const url = new URL(key);
      const apiKey = url.searchParams.get('api_key') || '';
      return apiKey ? { apiKey } : null;
    } catch {
      return null;
    }
  }

  get smsConfigured(): boolean {
    return !!(this.arkeselTemplate() || process.env.ARKESEL_API_KEY || (process.env.SMS_API_KEY && !/^https?:\/\//i.test(process.env.SMS_API_KEY.trim())));
  }

  private senderId(): string {
    return (process.env.ARKESEL_SENDER_ID || process.env.SMS_SENDER_ID || 'GHMotive').slice(0, 11);
  }

  private normalisePhone(phone: string): string {
    const cleaned = (phone || '').replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) return `233${cleaned.substring(1)}`;
    if (cleaned.startsWith('233')) return cleaned;
    return cleaned;
  }

  async sendSms(phone: string, message: string): Promise<SendResult> {
    const to = this.normalisePhone(phone);
    if (!to) return { delivered: false, provider: 'none', detail: 'no phone' };

    const template = this.arkeselTemplate();
    const v2Key = process.env.ARKESEL_API_KEY || (!template && process.env.SMS_API_KEY && !/^https?:\/\//i.test(process.env.SMS_API_KEY.trim()) ? process.env.SMS_API_KEY.trim() : '');

    try {
      if (template) {
        // Arkesel v1: GET /sms/api?action=send-sms&api_key=..&to=..&from=..&sms=..
        const qs = new URLSearchParams({
          action: 'send-sms',
          api_key: template.apiKey,
          to,
          from: this.senderId(),
          sms: message,
        });
        const raw = await this.httpsGet(`https://sms.arkesel.com/sms/api?${qs.toString()}`);
        const ok = /"code"\s*:\s*"?0?k|success/i.test(raw) && !/error|invalid|failed/i.test(raw.slice(0, 80));
        this.logger.log(`[SMS:arkesel-v1] To: ${to} | ${raw.slice(0, 160)}`);
        return { delivered: ok, provider: 'arkesel-v1', detail: raw.slice(0, 160) };
      }
      if (v2Key) {
        const raw = await this.httpsPostJson(
          'https://sms.arkesel.com/api/v2/sms/send',
          { sender: this.senderId(), message, recipients: [to] },
          { 'api-key': v2Key },
        );
        const ok = /"status"\s*:\s*"success"|"code"\s*:\s*"0k"/i.test(raw);
        this.logger.log(`[SMS:arkesel-v2] To: ${to} | ${raw.slice(0, 160)}`);
        return { delivered: ok, provider: 'arkesel-v2', detail: raw.slice(0, 160) };
      }
    } catch (err: any) {
      this.logger.error(`[SMS] Failed to ${to}: ${err?.message}`);
      return { delivered: false, provider: 'arkesel', detail: err?.message };
    }

    this.logger.warn(`[SMS:mock] To: ${to} | ${message.slice(0, 120)}`);
    return { delivered: false, provider: 'mock', detail: 'SMS not configured' };
  }

  // ── HTTP helpers ─────────────────────────────────────────────

  private httpsGet(urlString: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(urlString, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve(raw));
      });
      req.on('error', reject);
      req.setTimeout(15_000, () => { req.destroy(); reject(new Error('SMS request timeout')); });
    });
  }

  private httpsPostJson(urlString: string, payload: any, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const url = new URL(urlString);
      const req = https.request(
        { hostname: url.hostname, port: 443, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } },
        (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => resolve(raw));
        },
      );
      req.on('error', reject);
      req.setTimeout(15_000, () => { req.destroy(); reject(new Error('SMS request timeout')); });
      req.write(body);
      req.end();
    });
  }
}
