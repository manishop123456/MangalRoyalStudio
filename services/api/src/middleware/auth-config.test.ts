import { describe, expect, it } from 'vitest';
import { getOperationalReadiness, parseTrustedProxyCidrs, validateProductionConfigOnStartup } from './auth.js';

function validProductionEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: '3d9bcf4710a62e85f3217a94c5068bd123456789abcdef',
    CORS_ORIGIN: 'https://admin.mangalroyalstudio.com,https://shop.mangalroyalstudio.com',
    RAZORPAY_KEY_ID: 'rzp_live_1234567890abcdef',
    RAZORPAY_KEY_SECRET: 'b1234567890abcdef2345',
    RAZORPAY_WEBHOOK_SECRET: '71eac397d20fb456881234567890abcd',
    RESEND_API_KEY: 're_9876543210abcdef1234567890',
    EMAIL_FROM: 'accounts@mangalroyalstudio.in',
    STOREFRONT_PUBLIC_URL: 'https://shop.mangalroyalstudio.com',
    SHOPIFY_WEBHOOK_SECRET: 'cde9876543210abcdef1234567890',
  };
}

describe('production configuration validation', () => {
  it('accepts complete production configuration and reports readiness without secret values', () => {
    const env = validProductionEnvironment();
    expect(() => validateProductionConfigOnStartup(env)).not.toThrow();

    const readiness = getOperationalReadiness(env);
    expect(readiness.productionReady).toBe(true);
    expect(readiness.jwtConfigured).toBe(true);
    expect(JSON.stringify(readiness)).not.toContain(env.JWT_SECRET);
    expect(Object.keys(readiness)).not.toEqual(expect.arrayContaining([
      'JWT_SECRET', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'RESEND_API_KEY',
    ]));
  });

  it('rejects placeholder JWT secrets without echoing any secret value', () => {
    const env = validProductionEnvironment();
    env.JWT_SECRET = 'replace_with_32_byte_random_hex_secret_for_admin_jwt';
    expect(() => validateProductionConfigOnStartup(env)).toThrow(/strong JWT_SECRET/);
    expect(() => validateProductionConfigOnStartup(env)).toThrow(/strong JWT_SECRET/);
  });

  it('rejects weak or test-mode Razorpay production credentials', () => {
    const env = validProductionEnvironment();
    env.RAZORPAY_KEY_ID = 'rzp_test_mrs_audit';
    env.RAZORPAY_KEY_SECRET = 'test-only-razorpay-secret';

    expect(getOperationalReadiness(env).razorpayConfigured).toBe(false);
    expect(() => validateProductionConfigOnStartup(env)).toThrow(/RAZORPAY_KEY_ID \/ RAZORPAY_KEY_SECRET/);
  });

  it('rejects insecure wildcard CORS and non-HTTPS production verification URLs', () => {
    const env = validProductionEnvironment();
    env.CORS_ORIGIN = '*';
    env.STOREFRONT_PUBLIC_URL = 'http://shop.mangalroyalstudio.com';

    expect(() => validateProductionConfigOnStartup(env)).toThrow(/CORS_ORIGIN/);
    expect(getOperationalReadiness(env).emailVerificationConfigured).toBe(false);
  });

  it('accepts explicit proxy IPs/CIDRs and rejects wildcard, hop-count and overly broad trust', () => {
    expect(parseTrustedProxyCidrs('')).toEqual([]);
    expect(parseTrustedProxyCidrs('10.0.0.0/8, 192.168.1.5,2001:db8::/32')).toHaveLength(3);
    for (const bad of ['*', 'true', '1', '0.0.0.0/0', '::/0', '10.0.0.0/4', 'not-an-ip', '10.0.0.1/33']) {
      expect(() => parseTrustedProxyCidrs(bad)).toThrow(/INVALID_TRUSTED_PROXY_CIDRS/);
    }
    const env = validProductionEnvironment();
    env.TRUSTED_PROXY_CIDRS = '0.0.0.0/0';
    expect(() => validateProductionConfigOnStartup(env)).toThrow(/INVALID_TRUSTED_PROXY_CIDRS/);
  });
});
