import { google } from "googleapis";

const getGmailClient = async () => {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const refreshToken = process.env.REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Gmail API OAuth environment variables");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: "v1", auth: oauth2Client });
};

const encodeEmail = (value) => Buffer.from(value).toString("base64url");

export const sendLoginOtpEmail = async ({ to, otp }) => {
  const from = process.env.EMAIL_FROM || process.env.EMAIL;

  if (!from || !to || !otp) {
    throw new Error("Missing required email fields");
  }

  const subject = "Your Lovinks Login OTP";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Lovinks Login Verification</h2>
      <p style="margin-top: 0;">Use this OTP to complete your login:</p>
      <div style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 14px 0;">
        ${otp}
      </div>
      <p style="margin: 0;">This OTP will expire in 5 minutes.</p>
      <p style="margin-top: 12px;">If you did not request this login, please ignore this email.</p>
    </div>
  `;

  const text = `Lovinks Login Verification\n\nYour OTP is: ${otp}\nThis OTP will expire in 5 minutes.`;

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    "",
    text,
  ].join("\n");

  const gmail = await getGmailClient();

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeEmail(message),
    },
  });
};

export const sendPasswordResetOtpEmail = async ({ to, otp }) => {
  const from = process.env.EMAIL_FROM || process.env.EMAIL;

  if (!from || !to || !otp) {
    throw new Error("Missing required email fields");
  }

  const subject = "Reset your Lovinks password";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Lovinks Password Reset</h2>
      <p style="margin-top: 0;">Use this OTP to reset your password:</p>
      <div style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 14px 0;">
        ${otp}
      </div>
      <p style="margin: 0;">This OTP will expire in 5 minutes.</p>
      <p style="margin-top: 12px;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const text = `Lovinks Password Reset\n\nYour OTP is: ${otp}\nThis OTP will expire in 5 minutes.`;

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    "",
    text,
  ].join("\n");

  const gmail = await getGmailClient();

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeEmail(message),
    },
  });
};
