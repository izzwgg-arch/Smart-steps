import nodemailer from 'nodemailer'

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
  },
})

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  // If SMTP is not configured, log the email instead of sending
  if (!process.env.SMTP_USER || (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD)) {
    console.log('Email not configured. Would send email:', {
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    return
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })
    console.log(`Email sent successfully to ${options.to}`)
  } catch (error) {
    console.error('Failed to send email:', error)
    throw new Error('Failed to send email')
  }
}

export function getPasswordResetEmailHtml(
  resetLink: string,
  userName?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">Smart Steps</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">Password Reset Request</h2>
        
        <p>${userName ? `Hello ${userName},` : 'Hello,'}</p>
        
        <p>We received a request to reset your password for your Smart Steps account. If you didn't make this request, you can safely ignore this email.</p>
        
        <p>To reset your password, click the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="color: #2563eb; font-size: 12px; word-break: break-all;">${resetLink}</p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          <strong>Note:</strong> This link will expire in 1 hour for security reasons.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">
          If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Smart Steps. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

export function getPasswordResetEmailText(resetLink: string): string {
  return `
Password Reset Request

We received a request to reset your password for your Smart Steps account.

To reset your password, click the following link:
${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.
  `.trim()
}

// Timesheet Email Templates

export function getTimesheetSubmittedEmailHtml(
  timesheetId: string,
  clientName: string,
  providerName: string,
  startDate: string,
  endDate: string
): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const timesheetUrl = `${baseUrl}/timesheets`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Timesheet Submitted</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">Smart Steps</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">Timesheet Submitted for Review</h2>
        
        <p>A new timesheet has been submitted and is awaiting your approval.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Provider:</strong> ${providerName}</p>
          <p style="margin: 5px 0;"><strong>Period:</strong> ${startDate} - ${endDate}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${timesheetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Review Timesheet</a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Smart Steps. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

export function getTimesheetApprovedEmailHtml(
  clientName: string,
  providerName: string,
  startDate: string,
  endDate: string
): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const timesheetUrl = `${baseUrl}/timesheets`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Timesheet Approved</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">Smart Steps</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #10b981; margin-top: 0;">✓ Timesheet Approved</h2>
        
        <p>Your timesheet has been approved and is ready for invoicing.</p>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Provider:</strong> ${providerName}</p>
          <p style="margin: 5px 0;"><strong>Period:</strong> ${startDate} - ${endDate}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${timesheetUrl}" style="background-color: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Timesheet</a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Smart Steps. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

export function getTimesheetRejectedEmailHtml(
  clientName: string,
  providerName: string,
  startDate: string,
  endDate: string,
  rejectionReason: string | null
): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const timesheetUrl = `${baseUrl}/timesheets`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Timesheet Rejected</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">Smart Steps</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #ef4444; margin-top: 0;">Timesheet Rejected</h2>
        
        <p>Your timesheet has been rejected and requires revision.</p>
        
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Provider:</strong> ${providerName}</p>
          <p style="margin: 5px 0;"><strong>Period:</strong> ${startDate} - ${endDate}</p>
          ${rejectionReason ? `<p style="margin: 10px 0 5px 0;"><strong>Reason:</strong></p><p style="margin: 5px 0;">${rejectionReason}</p>` : ''}
        </div>
        
        <p>Please review the timesheet and make the necessary corrections.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${timesheetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Timesheet</a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Smart Steps. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

// Invoice Email Templates

export function getInvoiceGeneratedEmailHtml(
  invoiceCount: number,
  totalAmount: number
): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const invoiceUrl = `${baseUrl}/invoices`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoices Generated</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">Smart Steps</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">Automatic Invoice Generation</h2>
        
        <p>The automatic invoice generation job has completed successfully.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Invoices Created:</strong> ${invoiceCount}</p>
          <p style="margin: 5px 0;"><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invoiceUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Invoices</a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Smart Steps. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

// New User Invite Email Templates

export function getNewUserInviteEmailHtml(
  email: string,
  temporaryPassword: string,
  loginUrl: string,
  userName?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Smart Steps</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">Smart Steps</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">Welcome to Smart Steps!</h2>
        
        <p>${userName ? `Hello ${userName},` : 'Hello,'}</p>
        
        <p>Your account has been created. You will need to set a new password on your first login.</p>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 5px 0;"><strong>Your Login Credentials:</strong></p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #ffffff; padding: 4px 8px; border-radius: 3px; font-size: 14px; font-weight: bold;">${temporaryPassword}</code></p>
        </div>
        
        <p style="color: #dc2626; font-weight: bold;">⚠️ Important: You must change your password on first login.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Login to Smart Steps</a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          <strong>Security Note:</strong> Please keep your temporary password secure and change it immediately after logging in.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">
          If you did not expect this email, please contact your administrator.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} Smart Steps. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

export function getNewUserInviteEmailText(
  email: string,
  temporaryPassword: string,
  loginUrl: string
): string {
  return `
Welcome to Smart Steps!

Your account has been created. You will need to set a new password on your first login.

Your Login Credentials:
Email: ${email}
Temporary Password: ${temporaryPassword}

⚠️ Important: You must change your password on first login.

Login URL: ${loginUrl}

Security Note: Please keep your temporary password secure and change it immediately after logging in.

If you did not expect this email, please contact your administrator.
  `.trim()
}
