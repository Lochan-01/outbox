import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
let testAccount: nodemailer.TestAccount | null = null;

export async function initEtherealSMTP(): Promise<Transporter> {
  if (transporter) return transporter;

  try {
    testAccount = await nodemailer.createTestAccount();
    console.log('----------------------------------------------------');
    console.log('📬 ETHEREAL EMAIL TEST ACCOUNT INITIALIZED');
    console.log(`User:     ${testAccount.user}`);
    console.log(`Pass:     ${testAccount.pass}`);
    console.log(`Web URL:  https://ethereal.email/login`);
    console.log('----------------------------------------------------');

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    return transporter;
  } catch (error) {
    console.error('Failed to initialize Ethereal SMTP account:', error);
    throw error;
  }
}

export function getTransporter(): Transporter {
  if (!transporter) {
    throw new Error('Ethereal SMTP Transporter not initialized yet.');
  }
  return transporter;
}

export function getTestAccount(): nodemailer.TestAccount | null {
  return testAccount;
}

export async function sendMail(options: {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ messageId: string; previewUrl: string | false }> {
  const trans = getTransporter();
  const info = await trans.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text || options.html,
    html: options.html || options.text,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`✉️ Email sent to ${options.to}. Preview URL: ${previewUrl}`);
  }
  return {
    messageId: info.messageId,
    previewUrl: previewUrl,
  };
}
