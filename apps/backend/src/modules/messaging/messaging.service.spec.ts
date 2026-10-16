import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  const ORIGINAL = { ...process.env };
  const KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'EMAIL_FROM', 'SMS_API_KEY', 'ARKESEL_API_KEY', 'SMS_SENDER_ID', 'ARKESEL_SENDER_ID'];

  beforeEach(() => {
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
    jest.restoreAllMocks();
  });

  it('reports unconfigured state when SMTP and Arkesel are unset', () => {
    const s = new MessagingService();
    expect(s.emailConfigured).toBe(false);
    expect(s.smsConfigured).toBe(false);
  });

  it('normalises Ghana numbers to international format', () => {
    const s = new MessagingService() as any;
    expect(s.normalisePhone('0551234567')).toBe('233551234567');
    expect(s.normalisePhone('+233551234567')).toBe('233551234567');
    expect(s.normalisePhone('233551234567')).toBe('233551234567');
    expect(s.normalisePhone('020 123 4567')).toBe('233201234567');
  });

  it('parses the whole-URL Arkesel key and never uses placeholder sender', () => {
    process.env.SMS_API_KEY = 'https://sms.arkesel.com/sms/api?action=send-sms&api_key=REALKEY123&to=PhoneNumber&from=SenderID&sms=YourMessage';
    const s = new MessagingService() as any;
    expect(s.smsConfigured).toBe(true);
    expect(s.arkeselTemplate()).toEqual({ apiKey: 'REALKEY123' });
    expect(s.senderId()).toBe('GHMotive');
    expect(s.senderId()).not.toBe('SenderID');
  });

  it('email and sms fall back without throwing when providers are unset', async () => {
    const s = new MessagingService();
    const email = await s.sendEmail('a@test.com', 'Hi', 'Hello');
    expect(email.delivered).toBe(false);
    expect(email.provider).toBe('mock');
    const sms = await s.sendSms('+233551234567', 'Hello');
    expect(sms.delivered).toBe(false);
    expect(sms.provider).toBe('mock');
  });

  it('sends branded mail with a real reply-to and help footer', async () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'plus.on.motive@gmail.com';
    process.env.SMTP_PASS = 'app password';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    const s = new MessagingService() as any;
    s.getTransporter = () => ({ sendMail });
    const result = await s.sendEmail('user@example.com', 'Reset your password', 'Hello Ama, reset your password.');
    expect(result.delivered).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.from).toContain('Positive Motive');
    expect(mail.from).toContain('plus.on.motive@gmail.com');
    expect(mail.replyTo).toBe('plus.on.motive@gmail.com');
    expect(mail.text).toContain('Questions? Simply reply to this email');
    expect(mail.html).toContain('Positive Motive (+Motive)');
  });

  it('detects SMTP config and strips spaces from the Gmail app password path', () => {
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_USER = 'plus.on.motive@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    const s = new MessagingService() as any;
    expect(s.emailConfigured).toBe(true);
    // Gmail forces the authenticated account as From
    expect(s.fromAddress()).toContain('plus.on.motive@gmail.com');
  });
});
