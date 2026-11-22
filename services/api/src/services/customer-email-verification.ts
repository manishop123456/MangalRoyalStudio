import crypto from 'node:crypto';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createEmailVerificationToken(): { token: string; tokenHash: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export function isResendCooldownActive(lastSentAt: string | undefined, now = Date.now()): boolean {
  if (!lastSentAt) return false;
  const sent = Date.parse(lastSentAt);
  return Number.isFinite(sent) && now - sent < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;
}

/** Constant-time comparison of two hex SHA-256 digests. */
export function verificationHashesMatch(candidateHash: string, storedHash: string | undefined): boolean {
  if (!storedHash || candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));
}

export function hashEmailVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isEmailVerificationConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const from = process.env.EMAIL_FROM?.trim() || '';
  const storefrontUrl = process.env.STOREFRONT_PUBLIC_URL?.trim() || '';
  try {
    const parsedUrl = new URL(storefrontUrl);
    return Boolean(
      apiKey && !apiKey.toLowerCase().startsWith('replace_me') &&
        from.includes('@') && !from.toLowerCase().includes('example.com') &&
        ['https:', 'http:'].includes(parsedUrl.protocol)
    );
  } catch {
    return false;
  }
}

export async function sendEmailVerification(email: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const storefrontUrl = process.env.STOREFRONT_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (!isEmailVerificationConfigured() || !apiKey || !from || !storefrontUrl) {
    throw new Error('Email verification is not configured.');
  }

  const verificationUrl = `${storefrontUrl}/account/verify-email#token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Verify your Mangal Royal Studio email address',
      html: `<p>Verify your email to activate your Mangal Royal Studio account.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this message.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider rejected the verification message (${response.status}).`);
  }
}
