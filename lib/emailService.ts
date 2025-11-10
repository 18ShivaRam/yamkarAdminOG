import nodemailer from 'nodemailer';

// Email service configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true', // Use SSL
    auth: {
      user: process.env.SMTP_USER || 'shivam18758@gmail.com',
      pass: process.env.SMTP_PASSWORD || '', // App password from Gmail
    },
  });
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Yamkar Admin Portal',
        address: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'shivam18758@gmail.com'
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    console.log('Attempting to send email to:', options.to);
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

export const sendPasswordResetEmail = async (
  email: string, 
  name: string, 
  resetUrl: string
): Promise<boolean> => {
  const subject = 'Password Reset Request - Yamkar Admin Portal';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
          <p>Yamkar Admin Portal</p>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your password for your Yamkar Admin Portal account.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset My Password</a>
          </p>
          <div class="warning">
            <strong>⚠️ Important Security Information:</strong>
            <ul>
              <li>This link will expire in <strong>1 hour</strong></li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Never share this link with anyone</li>
            </ul>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
            ${resetUrl}
          </p>
        </div>
        <div class="footer">
          <p>This email was sent from Yamkar Admin Portal</p>
          <p>If you have any questions, please contact your system administrator</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: email,
    subject,
    html,
  });
};
