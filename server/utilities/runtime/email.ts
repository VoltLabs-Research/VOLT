import nodemailer, { Transporter } from 'nodemailer';

type EmailAttachment = {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}

type SendEmailArgs = {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
    fromName?: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
};

let cachedTransporter: Transporter | null = null;

const getTransporter = (): Transporter => {
    if(cachedTransporter) return cachedTransporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 465);
    const user = process.env.SMTP_AUTH_USER;
    const pass = process.env.SMTP_AUTH_PASSWORD;

    if(!host || !user || !pass){
        throw new Error('SMTP_HOST / SMTP_AUTH_USER / SMTP_AUTH_PASSWORD');
    }

    if(!Number.isFinite(port)){
        throw new Error('Invalid SMTP_PORT');
    }

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });

    return cachedTransporter;
};

export async function sendEmailNotification({
    to,
    subject,
    text,
    html,
    fromName = "No Reply",
    replyTo,
    attachments,
}: SendEmailArgs): Promise<void>{
    const transporter = getTransporter();
    const fromUser = process.env.SMTP_AUTH_USER!;

    await transporter.sendMail({
        from: `${fromName} <${fromUser}>`,
        to,
        subject,
        text,
        html,
        replyTo,
        attachments,
    });
};
