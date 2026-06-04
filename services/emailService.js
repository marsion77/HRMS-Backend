const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
  
  const mailOptions = {
    from: `"SAP HRMS Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to SAP HRMS - Activate Your Account',
    html: `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; border: 2px solid #1e293b; background-color: #ffffff; color: #0f172a;">
        <h2 style="font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 20px; color: #0f172a;">
          SAP HRMS INVITATION
        </h2>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Hello <strong>${name}</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
          You have been registered as an <strong>${role}</strong> in the SAP Human Resource Management System. 
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
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Activation email successfully sent to ${email}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send activation email to ${email}:`, error);
    throw error;
  }
};

module.exports = {
  sendActivationEmail
};
