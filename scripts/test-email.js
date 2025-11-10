// Test script to verify Gmail SMTP configuration
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testEmailConnection() {
  console.log('🧪 Testing Gmail SMTP Connection...\n');
  
  // Create transporter with your Gmail configuration
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: process.env.SMTP_USER || 'shivam18758@gmail.com',
      pass: process.env.SMTP_PASSWORD || '',
    },
  });

  try {
    // Test the connection
    console.log('📡 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');

    // Send a test email
    console.log('📧 Sending test email...');
    const testEmail = {
      from: {
        name: 'Yamkar Admin Portal',
        address: process.env.SMTP_USER || 'shivam18758@gmail.com'
      },
      to: process.env.SMTP_USER || 'shivam18758@gmail.com', // Send to yourself for testing
      subject: '🧪 Test Email - Gmail SMTP Configuration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
            <h1>🎉 Gmail SMTP Test Successful!</h1>
            <p>Your Gmail SMTP configuration is working correctly</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 10px; margin-top: 20px;">
            <h2>Configuration Details:</h2>
            <ul>
              <li><strong>Host:</strong> smtp.gmail.com</li>
              <li><strong>Port:</strong> 465 (SSL)</li>
              <li><strong>Email:</strong> ${process.env.SMTP_USER || 'shivam18758@gmail.com'}</li>
              <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
            </ul>
            <p style="color: #28a745; font-weight: bold;">✅ Password reset emails should now work correctly!</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log('📬 Message ID:', result.messageId);
    console.log('📧 Check your inbox at:', process.env.SMTP_USER || 'shivam18758@gmail.com');
    
  } catch (error) {
    console.error('❌ SMTP Test Failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n🔐 Authentication Error - Possible Solutions:');
      console.log('1. Make sure you\'re using an App Password, not your regular Gmail password');
      console.log('2. Enable 2-Factor Authentication on your Gmail account');
      console.log('3. Generate a new App Password from: https://myaccount.google.com/apppasswords');
      console.log('4. Update SMTP_PASSWORD in your .env.local file');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n🌐 Connection Error - Possible Solutions:');
      console.log('1. Check your internet connection');
      console.log('2. Verify firewall/antivirus isn\'t blocking port 465');
      console.log('3. Try using port 587 with STARTTLS instead');
    }
  }
}

// Run the test
testEmailConnection();
