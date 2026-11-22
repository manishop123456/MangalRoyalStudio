'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CustomizationGroupRecord,
  CustomizationOptionRecord,
  CustomizationProfileRecord,
  CustomizationQuoteResponse,
  ProductCustomizationAssignmentRecord,
} from '@mrs/shared';
import { API_BASE_URL } from '../lib/storefront-data';
import {
  friendlyApiError,
  friendlyThrown,
  PRICE_ON_REQUEST_LABEL,
  PRICE_ON_REQUEST_NOTE,
  QUOTE_UNAVAILABLE_NOTE,
  readJsonSafely,
} from '../lib/customer-messages';

const NOTICE_STYLE: React.CSSProperties = {
  marginTop: '10px',
  padding: '10px 12px',
  background: '#FBF3F0',
  border: '1px solid #E6D3CE',
  color: '#5A2A33',
  fontSize: '12.5px',
  lineHeight: 1.5,
};

export interface ProductCustomizerProps {
  sku: string;
  productTitle: string;
  productCategory: string;
  profile: CustomizationProfileRecord;
  assignment: ProductCustomizationAssignmentRecord | null;
  initialSelections?: Record<string, string>;
  editingDesignId?: string | null;
  editingDesignName?: string | null;
  isCustomerLoggedIn: boolean;
  /** False when the base piece is Price on request: no quote is requested and no amounts are shown. */
  priceAvailable?: boolean;
  onSelectionsChange?: (selections: Record<string, string>, swatchHex?: string) => void;
  onAddCustomToCart: (params: {
    selections: Record<string, string>;
    quote: CustomizationQuoteResponse;
    customerDesignId?: string;
  }) => Promise<void>;
  onSaveDesign: (params: {
    name: string;
    selections: Record<string, string>;
    designId?: string;
  }) => Promise<{ id: string; name: string }>;
}

function formatInr(val: string | number): string {
  const num = Number(val);
  if (Number.isNaN(num)) return `₹${val}`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export default function ProductCustomizer({
  sku,
  productTitle,
  productCategory,
  profile,
  assignment,
  initialSelections,
  editingDesignId,
  editingDesignName,
  isCustomerLoggedIn,
  priceAvailable = true,
  onSelectionsChange,
  onAddCustomToCart,
  onSaveDesign,
}: ProductCustomizerProps) {
  const activeGroups = useMemo(
    () =>
      [...profile.groups]
        .filter((g) => g.isActive)
        .filter((g) => {
          if (g.optionCategory === 'ENGRAVING' && !(assignment?.allowEngraving ?? false)) {
            return false;
          }
          if (g.optionCategory === 'DIAMOND' && assignment && !assignment.allowDiamondSelection) {
            return false;
          }
          if (
            g.dependencyRule?.allowedCategories &&
            g.dependencyRule.allowedCategories.length > 0 &&
            !g.dependencyRule.allowedCategories.some(
              (c) => c.trim().toLowerCase() === productCategory.trim().toLowerCase()
            )
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.stepOrder - b.stepOrder),
    [profile.groups, assignment, productCategory]
  );

  const disabledCodes = useMemo(
    () => new Set((assignment?.disabledOptionCodes ?? []).map((c) => c.trim().toUpperCase())),
    [assignment]
  );

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const grp of activeGroups) {
      if (initialSelections && initialSelections[grp.code] !== undefined) {
        base[grp.code] = initialSelections[grp.code]!;
        continue;
      }
      if (grp.selectionMode === 'SINGLE') {
        const def =
          grp.options.find(
            (o) => o.isActive && o.isDefault && !disabledCodes.has(o.code.toUpperCase())
          ) || grp.options.find((o) => o.isActive && !disabledCodes.has(o.code.toUpperCase()));
        if (def) base[grp.code] = def.code;
      }
    }
    return base;
  });

  const [quote, setQuote] = useState<CustomizationQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  // Quotes are fetched on demand (first option change or "Get price"), never automatically on page load.
  const [quoteRequested, setQuoteRequested] = useState<boolean>(Boolean(editingDesignId));
  const [addingToCart, setAddingToCart] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [saveName, setSaveName] = useState(editingDesignName || `${productTitle} Custom`);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const seqRef = useRef(0);

  // Sync swatch hex for 3D viewer / parent
  useEffect(() => {
    let hex: string | undefined;
    for (const grp of activeGroups) {
      const code = selections[grp.code];
      if (!code) continue;
      const opt = grp.options.find((o) => o.code === code);
      if (opt?.swatchHex) {
        hex = opt.swatchHex;
        break;
      }
    }
    onSelectionsChange?.(selections, hex);
  }, [selections, activeGroups, onSelectionsChange]);

  // Authoritative server quote fetch with stale-response protection
  useEffect(() => {
    if (!priceAvailable || !quoteRequested) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    const reqSeq = ++seqRef.current;
    const controller = new AbortController();

    async function fetchQuote() {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/public/customization/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productHandleOrSku: sku,
            selections,
            quantity: 1,
          }),
          signal: controller.signal,
        });
        const data = (await readJsonSafely(res)) as { quote?: CustomizationQuoteResponse } | null;
        if (seqRef.current !== reqSeq) return; // Ignore stale response
        if (!res.ok || !data?.quote) {
          setQuote(null);
          setQuoteError(friendlyApiError(res.status, data, QUOTE_UNAVAILABLE_NOTE));
          return;
        }
        setQuote(data.quote);
      } catch (err: any) {
        if (err?.name === 'AbortError' || seqRef.current !== reqSeq) return;
        setQuoteError(QUOTE_UNAVAILABLE_NOTE);
      } finally {
        if (seqRef.current === reqSeq) setQuoteLoading(false);
      }
    }

    void fetchQuote();
    return () => controller.abort();
  }, [sku, selections, priceAvailable, quoteRequested]);

  // Surcharge amounts are only meaningful next to a valid server quote.
  const showAmounts = priceAvailable && Boolean(quote) && !quoteError;

  const selectedMetalType = useMemo(() => {
    for (const grp of activeGroups) {
      const opt = grp.options.find((o) => o.code === selections[grp.code]);
      if (opt?.metalType) return opt.metalType;
    }
    return undefined;
  }, [activeGroups, selections]);

  const isOptionDisabled = (opt: CustomizationOptionRecord): boolean => {
    if (!opt.isActive || disabledCodes.has(opt.code.toUpperCase())) return true;
    if (
      opt.eligibilityRule?.allowedMetalTypes &&
      opt.eligibilityRule.allowedMetalTypes.length > 0 &&
      selectedMetalType &&
      !opt.eligibilityRule.allowedMetalTypes.includes(selectedMetalType)
    ) {
      return true;
    }
    return false;
  };

  const handleSelectOption = (grp: CustomizationGroupRecord, optCode: string) => {
    setFeedback(null);
    setQuoteRequested(true);
    setSelections((prev) => ({ ...prev, [grp.code]: optCode }));
  };

  const handleAdd = async () => {
    if (!priceAvailable || quoteError) return;
    if (!quote) {
      setQuoteRequested(true);
      return;
    }
    setAddingToCart(true);
    setFeedback(null);
    try {
      await onAddCustomToCart({
        selections,
        quote,
        customerDesignId: editingDesignId ?? undefined,
      });
      setFeedback({ type: 'success', text: 'Custom piece added to your shopping bag.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: friendlyThrown(err, 'Unable to add custom piece to bag.') });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSave = async () => {
    if (!isCustomerLoggedIn) {
      setFeedback({
        type: 'error',
        text: 'Please sign in to your Mangal Royal account to save custom designs.',
      });
      return;
    }
    setSavingDesign(true);
    setFeedback(null);
    try {
      const saved = await onSaveDesign({
        name: saveName.trim() || `${productTitle} Custom`,
        selections,
        designId: editingDesignId ?? undefined,
      });
      setFeedback({
        type: 'success',
        text: editingDesignId
          ? `Updated saved design "${saved.name}".`
          : `Saved "${saved.name}" to your account.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: friendlyThrown(err, 'Unable to save design.') });
    } finally {
      setSavingDesign(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--mrs-border)] bg-white p-5 shadow-sm">
      <div className="mb-4 border-b border-[var(--mrs-border)] pb-3">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#7D132A] uppercase">
          Bespoke Atelier · {profile.name}
        </p>
        <h2 className="mt-1 font-serif text-xl text-neutral-900">Customize Your Piece</h2>
        {profile.description ? (
          <p className="mt-1 text-xs text-neutral-600">{profile.description}</p>
        ) : null}
      </div>

      <div className="space-y-5">
        {activeGroups.map((grp, idx) => {
          const activeOpts = [...grp.options]
            .filter((o) => o.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder);

          return (
            <div key={grp.id} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="text-xs font-semibold tracking-wider text-neutral-800 uppercase">
                  {idx + 1}. {grp.name}
                  {grp.isRequired ? <span className="ml-1 text-[#7D132A]">*</span> : null}
                </label>
                {grp.selectionMode === 'SINGLE' && selections[grp.code] ? (
                  <span className="text-xs text-neutral-500">
                    {activeOpts.find((o) => o.code === selections[grp.code])?.label}
                  </span>
                ) : null}
              </div>

              {grp.description ? <p className="text-xs text-neutral-500">{grp.description}</p> : null}

              {grp.selectionMode === 'TEXT' ? (
                <div>
                  <input
                    type="text"
                    maxLength={assignment?.maxEngravingChars ?? 20}
                    value={selections[grp.code] || ''}
                    placeholder={`Enter optional engraving (max ${assignment?.maxEngravingChars ?? 20} chars)`}
                    onChange={(e) => {
                      setFeedback(null);
                      setQuoteRequested(true);
                      setSelections((prev) => ({ ...prev, [grp.code]: e.target.value }));
                    }}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-[#7D132A] focus:outline-none"
                  />
                  {showAmounts && activeOpts[0]?.priceRuleType === 'FIXED_INR' && Number(activeOpts[0].priceRuleValue) > 0 ? (
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Engraving fee when text is entered: +{formatInr(activeOpts[0].priceRuleValue)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeOpts.map((opt) => {
                    const selected = selections[grp.code] === opt.code;
                    const disabled = isOptionDisabled(opt);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleSelectOption(grp, opt.code)}
                        className={`flex items-center gap-2 rounded border px-3 py-2 text-left text-xs transition ${
                          selected
                            ? 'border-[#7D132A] bg-[#7D132A]/5 font-semibold text-[#7D132A]'
                            : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500'
                        } ${disabled ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                      >
                        {opt.swatchHex ? (
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-full border border-neutral-400"
                            style={{ backgroundColor: opt.swatchHex }}
                          />
                        ) : null}
                        <span>{opt.label}</span>
                        {showAmounts && opt.priceRuleType === 'FIXED_INR' && Number(opt.priceRuleValue) > 0 ? (
                          <span className="text-[10px] text-neutral-500">
                            +{formatInr(opt.priceRuleValue)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Authoritative Server Quote Summary */}
      <div className="mt-6 rounded border border-[var(--mrs-border)] bg-[#FAF7F5] p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-neutral-700 uppercase">
            Live Atelier Quote
          </span>
          {quoteLoading ? (
            <span className="text-xs text-[#7D132A]">Calculating...</span>
          ) : quote ? (
            <span className="font-serif text-xl font-semibold text-[#7D132A]">
              {formatInr(quote.unitPriceInr)}
            </span>
          ) : null}
        </div>

        {!priceAvailable ? (
          <p role="status" style={NOTICE_STYLE}>
            <strong>{PRICE_ON_REQUEST_LABEL}.</strong> {PRICE_ON_REQUEST_NOTE}
          </p>
        ) : quoteError ? (
          <p role="status" style={NOTICE_STYLE}>{quoteError}</p>
        ) : quote ? (
          <div className="mt-3 space-y-1 border-t border-[var(--mrs-border)] pt-2 text-xs text-neutral-700">
            {quote.breakdownLines.map((line) => (
              <div key={line.key} className="flex justify-between">
                <span>{line.label}</span>
                <span>{formatInr(line.amountInr)}</span>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-neutral-500">Inclusive of GST</p>
          </div>
        ) : !quoteLoading ? (
          <p style={{ ...NOTICE_STYLE, background: 'transparent', border: 'none', padding: '6px 0 0' }}>
            Choose your options, then select “Get Bespoke Price” to see your personalised price.
          </p>
        ) : null}
      </div>

      {/* Save Design + Add to Bag */}
      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this custom design"
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-xs focus:border-[#7D132A] focus:outline-none"
          />
          <button
            type="button"
            disabled={savingDesign || quoteLoading || Boolean(quoteError)}
            onClick={handleSave}
            className="rounded border border-[#7D132A] px-4 py-2 text-xs font-semibold tracking-wider text-[#7D132A] uppercase hover:bg-[#7D132A]/5 disabled:opacity-50"
          >
            {savingDesign ? 'Saving...' : editingDesignId ? 'Update Saved Design' : 'Save Design'}
          </button>
        </div>

        {!priceAvailable || quoteError ? (
          <a
            href="/pages/contact"
            className="block w-full rounded bg-[#7D132A] px-5 py-3 text-center text-xs font-semibold tracking-[0.16em] text-white uppercase"
            style={{ display: 'block', textAlign: 'center', padding: '12px 20px', background: '#7D132A', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none' }}
          >
            Contact the Studio for a Quote
          </a>
        ) : (
          <button
            type="button"
            disabled={quoteLoading || addingToCart}
            onClick={handleAdd}
            className="w-full rounded bg-[#7D132A] px-5 py-3 text-xs font-semibold tracking-[0.16em] text-white uppercase transition hover:bg-[#610E20] disabled:opacity-50"
          >
            {addingToCart
              ? 'Adding Bespoke Piece...'
              : quote
                ? `Add Bespoke Piece to Bag · ${formatInr(quote.unitPriceInr)}`
                : quoteLoading
                  ? 'Calculating Price...'
                  : 'Get Bespoke Price'}
          </button>
        )}

        {feedback ? (
          <p
            className={`rounded p-2 text-xs ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {feedback.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
