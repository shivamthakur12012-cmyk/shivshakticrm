import nodemailer from 'nodemailer';
import logger from '../utils/logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST || 'smtp-prod.mailrcld.com';
      const port = Number(process.env.SMTP_PORT) || 587;
      const user = process.env.SMTP_USER || 'arthovista@gmail.com';
      const pass = process.env.SMTP_PASSWORD || '5bf07170245197511b5e7a735030ff20';

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      logger.info(`EmailService: Initialized SMTP transport to ${host}:${port} (${user})`);
    }
    return this.transporter;
  }

  /**
   * Send an individual email using MailerCloud SMTP with API fallback
   */
  static async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const fromAddress = process.env.SMTP_FROM || 'support@pcs.com';
    const formattedFrom = options.from || `"PCS CRM" <${fromAddress}>`;

    const htmlBody = options.html || (
      options.text
        ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${options.text.replace(/\n/g, '<br/>')}</div>`
        : '<p></p>'
    );

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: formattedFrom,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: htmlBody,
        replyTo: options.replyTo || 'arthovista@gmail.com',
        attachments: options.attachments
      });

      logger.info(`EmailService: Successfully dispatched email to ${options.to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
        provider: 'MailerCloud SMTP'
      };
    } catch (smtpError: any) {
      logger.warn(`EmailService SMTP attempt warning: ${smtpError.message}. Attempting MailerCloud API fallback...`);
      // Reset cached transporter so subsequent attempts can re-establish connection
      this.transporter = null;
      
      // Fallback to MailerCloud Direct API
      const apiKey = process.env.MAILERCLOUD_API_KEY || 'UIaYa-ed5823b131662aaf9808862ace68ad5a-d42fc0ccf553dccf3d4a12bcac65ddbf';
      try {
        const response = await fetch('https://cloudapi.mailercloud.com/v1/transactional/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'api-key': apiKey
          },
          body: JSON.stringify({
            from: fromAddress,
            from_name: 'ArthaVenture CRM',
            to: [{ email: options.to }],
            subject: options.subject,
            body: options.html || options.text
          })
        });

        if (response.ok) {
          const apiData: any = await response.json().catch(() => ({}));
          logger.info(`EmailService: Sent email via MailerCloud API fallback to ${options.to}`);
          return {
            success: true,
            messageId: apiData.id || `mc_${Date.now()}`,
            provider: 'MailerCloud API'
          };
        } else {
          const errText = await response.text();
          logger.error(`MailerCloud API fallback responded with status ${response.status}: ${errText}`);
          return {
            success: false,
            provider: 'MailerCloud',
            error: `Email could not be delivered. SMTP Error: ${smtpError.message}. Please check your SMTP quota or configuration in .env.`
          };
        }
      } catch (apiError: any) {
        logger.error(`EmailService: All email dispatch mechanisms failed:`, apiError);
        return {
          success: false,
          provider: 'MailerCloud',
          error: `Email delivery failed: ${smtpError.message || apiError.message}. Check SMTP settings in .env.`
        };
      }
    }
  }

  /**
   * Send bulk emails with rate limiting & individualized token replacement
   */
  static async sendBulk(
    recipients: Array<{ email: string; name?: string; variables?: Record<string, string> }>,
    template: { subject: string; html: string }
  ): Promise<{ total: number; sent: number; failed: number; results: EmailSendResult[] }> {
    const results: EmailSendResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      let personalizedSubject = template.subject;
      let personalizedHtml = template.html;

      if (recipient.name) {
        personalizedSubject = personalizedSubject.replace(/\{\{name\}\}/gi, recipient.name);
        personalizedHtml = personalizedHtml.replace(/\{\{name\}\}/gi, recipient.name);
      }

      if (recipient.variables) {
        for (const [key, val] of Object.entries(recipient.variables)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
          personalizedSubject = personalizedSubject.replace(regex, val);
          personalizedHtml = personalizedHtml.replace(regex, val);
        }
      }

      const result = await this.sendEmail({
        to: recipient.email,
        subject: personalizedSubject,
        html: personalizedHtml
      });

      results.push(result);
      if (result.success) sent++;
      else failed++;
    }

    return {
      total: recipients.length,
      sent,
      failed,
      results
    };
  }
}
