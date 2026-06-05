const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,   // 10 seconds
  socketTimeout: 15000      // 15 seconds
});

/**
 * Helper to send email using either HTTP APIs (Brevo / Resend) if configured,
 * or fallback to Nodemailer SMTP.
 */
const sendEmail = async ({ to, toName, subject, html }) => {
  // 1. Try Brevo API (requires key starting with xkeysib-)
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.startsWith('xkeysib-')) {
    console.log('Sending email via Brevo HTTP API...');
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Apex HRMS Admin', email: process.env.EMAIL_USER },
        to: [{ email: to, name: toName || to }],
        subject: subject,
        htmlContent: html
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Brevo API error: ${response.status}`);
    }
    const result = await response.json();
    console.log(`Email successfully sent via Brevo to ${to}. MessageId: ${result.messageId}`);
    return true;
  }

  // 2. Try Resend API (requires key starting with re_)
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_')) {
    console.log('Sending email via Resend HTTP API...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: `Apex HRMS Admin <${process.env.EMAIL_USER || 'onboarding@resend.dev'}>`,
        to: [to],
        subject: subject,
        html: html
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Resend API error: ${response.status}`);
    }
    const result = await response.json();
    console.log(`Email successfully sent via Resend to ${to}. Id: ${result.id}`);
    return true;
  }

  // 3. Fallback to standard Nodemailer SMTP (works locally)
  console.log('Sending email via Nodemailer SMTP...');
  const mailOptions = {
    from: `"Apex HRMS Admin" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    html: html
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email successfully sent via SMTP to ${to}. MessageId: ${info.messageId}`);
  return true;
};

/**
 * Sends an activation link to the newly created user (HR or Employee)
 * @param {string} email 
 * @param {string} name 
 * @param {string} role 
 * @param {string} token 
 */
const sendActivationEmail = async (email, name, role, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const activationLink = `${frontendUrl}/activate/${token}`;
  
  const subject = 'Welcome to Apex HRMS - Activate Your Account';
  const html = `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; border: 2px solid #1e293b; background-color: #ffffff; color: #0f172a;">
        <h2 style="font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px; color: #0f172a;">
          Apex HRMS INVITATION
        </h2>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Hello <strong>${name}</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
          You have been registered as an <strong>${role}</strong> in the Apex Human Resource Management System. 
          Please click the button below to set your password and activate your account.
        </p>
        <div style="margin: 30px 0;">
          <a href="${activationLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 14px; font-weight: bold; border-radius: 0px; text-transform: uppercase; border: 2px solid #0f172a; text-align: center;">
            Activate My Account
          </a>
        </div>
        <p style="font-size: 14px; line-height: 1.5; color: #64748b; margin-top: 25px;">
          If the button does not work, copy and paste this URL into your browser:
        </p>
        <p style="font-size: 13px; word-break: break-all; color: #3b82f6; text-decoration: underline; background-color: #f8fafc; padding: 10px; border: 1px dashed #cbd5e1; font-family: monospace;">
          ${activationLink}
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
          This link will expire in 24 hours. If you did not expect this email, you can safely ignore it.
        </p>
      </div>
    `;

  try {
    await sendEmail({ to: email, toName: name, subject, html });
    return true;
  } catch (error) {
    console.error(`Failed to send activation email to ${email}:`, error);
    throw error;
  }
};

module.exports = {
  sendActivationEmail
};
