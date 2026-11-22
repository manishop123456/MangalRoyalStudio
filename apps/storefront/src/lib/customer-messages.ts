/**
 * Customer-facing wording for the storefront.
 *
 * Rule: the storefront never renders raw server text, internal error/reason codes (e.g. PRICING_RULE_NOT_APPROVED),
 * pricing-rule names or backend details. API failures are translated by HTTP status / error code into fixed,
 * friendly sentences; anything unknown falls back to the caller's generic sentence.
 */

export const PRICE_ON_REQUEST_LABEL = 'Price on request';
export const PRICE_ON_REQUEST_NOTE = 'Contact our studio for a personalised quote on this piece.';
export const QUOTE_UNAVAILABLE_NOTE =
  'Live bespoke pricing is not available right now. Please contact our studio for a personalised quote.';
export const PREVIEW_UNAVAILABLE_NOTE = 'This feature is not available in the preview showcase.';

const CODE_MESSAGES: Record<string, string> = {
  PRICE_ON_REQUEST: 'This piece is priced on request. Please contact our studio for a personalised quote.',
  PRICING_RULE_UNAVAILABLE: QUOTE_UNAVAILABLE_NOTE,
  PRICING_CONFIGURATION_INCOMPLETE: QUOTE_UNAVAILABLE_NOTE,
  NO_ACTIVE_PRICING_RULE: QUOTE_UNAVAILABLE_NOTE,
  CUSTOMIZATION_UNAVAILABLE: 'Customisation is not available for this piece right now.',
  PRODUCT_NOT_CUSTOMIZABLE: 'Customisation is not available for this piece.',
  SELECTIONS_REQUIRED: 'Please choose an option in every required step.',
  INVALID_QUANTITY: 'Please choose a valid quantity.',
  INSUFFICIENT_STOCK: 'Sorry, the requested quantity is not available right now.',
  CHECKOUT_IN_PROGRESS: 'This piece is being reserved by another order. Please try again in a moment.',
  PRODUCT_NOT_FOUND: 'This piece is no longer available.',
  DESIGN_NOT_FOUND: 'This saved design could not be found.',
  ORDER_NOT_FOUND: 'We could not find that order.',
  CART_ITEM_NOT_FOUND: 'That item is no longer in your bag.',
  INVALID_DISCOUNT_CODE: 'That discount code is not valid.',
  INVALID_PINCODE: 'Please enter a valid 6-digit PIN code.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists. Please sign in instead.',
  INVALID_VERIFICATION_TOKEN: 'This verification link is invalid or has expired. Please request a new one.',
  VERIFICATION_EMAIL_UNAVAILABLE: 'We could not send a verification email right now. Please try again later.',
  EMAIL_VERIFICATION_UNAVAILABLE: 'Email verification is not available right now. Please try again later.',
  ORDER_NOT_CANCELLABLE: 'This order can no longer be cancelled online. Please contact our studio.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
  SHOWCASE_FORBIDDEN: PREVIEW_UNAVAILABLE_NOTE,
  SHOWCASE_READ_ONLY: PREVIEW_UNAVAILABLE_NOTE,
};

function statusMessage(status: number): string | null {
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return PREVIEW_UNAVAILABLE_NOTE;
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 429) return CODE_MESSAGES.TOO_MANY_REQUESTS!;
  if (status >= 500) return 'Something went wrong on our side. Please try again shortly.';
  return null;
}

/** Friendly message for a failed API response. Never returns server-provided text. */
export function friendlyApiError(status: number, body: unknown, fallback: string): string {
  const code =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? ((body as { error: string }).error)
      : '';
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]!;
  return statusMessage(status) ?? fallback;
}

/** Friendly text for a thrown error: only messages created by the storefront itself are shown. */
export function friendlyThrown(err: unknown, fallback: string): string {
  return err instanceof CustomerFacingError ? err.message : fallback;
}

/** An error whose message is already customer-safe (built from friendlyApiError or fixed wording). */
export class CustomerFacingError extends Error {}

/** Parses a JSON body without throwing (blocked/proxy responses may not be JSON). */
export async function readJsonSafely(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Contains an internal-looking token (SCREAMING_SNAKE code, stack frame, file path)? Used by tests. */
export function looksInternal(text: string): boolean {
  return (
    /\b[A-Z]{2,}(?:_[A-Z0-9]{2,})+\b/.test(text) ||
    /\.(?:js|ts):\d+|node_modules|\/srv\/|placeholder|owner-updated|override price|pending owner/i.test(text)
  );
}

// ---------------------------------------------------------------------------------------------
// Customer session hint (HttpOnly cookie cannot be read by JS). Only browsers that signed in here
// ask the server for the session, so anonymous visitors make no session request at all.
// ---------------------------------------------------------------------------------------------
const SESSION_HINT_KEY = 'mrs_customer_session_hint_v1';

export function hasCustomerSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCustomerSessionHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // storage unavailable: behave as signed out
  }
}
