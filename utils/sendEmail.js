const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Create a transporter object using SMTP transport
  //    Make sure SMTP_USER, SMTP_PASSWORD, EMAIL_FROM are loaded from process.env
  //    You might need to check Brevo's documentation for the correct host and port.
  //    Common Brevo SMTP host: smtp-relay.brevo.com
  //    Common ports: 587 (TLS) or 465 (SSL)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com', // Add SMTP_HOST to .env or use default
    port: process.env.SMTP_PORT || 587, // Add SMTP_PORT to .env or use default
    secure: (process.env.SMTP_PORT || 587) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // Your Brevo SMTP login
      pass: process.env.SMTP_PASSWORD, // Your Brevo SMTP password/key
    },
    // Optional: If using port 587 with TLS
    // tls: {
    //   ciphers:'SSLv3'
    // }
  });

  // 2. Define the email options
  const mailOptions = {
    from: process.env.EMAIL_FROM, // Sender address (e.g., '"SportsBookSL" <no-reply@yourdomain.com>')
    to: options.email, // Recipient's email address
    subject: options.subject, // Subject line
    text: options.message, // Plain text body (optional)
    html: options.html, // HTML body (recommended)
  };

  // 3. Actually send the email
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully: %s', info.messageId);
    // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); // Only works with ethereal email
  } catch (error) {
    console.error('Error sending email:', error);
    // You might want to throw the error or handle it differently
    // depending on whether email failure should block the user action.
    // For confirmations, it's often better to log the error but not fail the request.
  }
};

module.exports = sendEmail;