import { BUSINESS_INFO } from './business-info';

export type PolicyBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'ownerConfirm'; text: string }
  | { type: 'callout'; title: string; text: string };

export interface PolicyDocument {
  slug: string;
  partLabel: string;
  title: string;
  subtitle: string;
  effectiveDate: string;
  blocks: PolicyBlock[];
}

const B = BUSINESS_INFO;
const BRAND = `${B.legalName}, trading as ${B.brandName}`;

export const POLICIES_MAP: Record<string, PolicyDocument> = {
  'terms-of-service': {
    slug: 'terms-of-service',
    partLabel: 'Part I',
    title: 'Terms & Conditions of Use and Sale',
    subtitle: `Effective ${B.effectiveDate} · Version ${B.version} · Governed by the laws of India`,
    effectiveDate: B.effectiveDate,
    blocks: [
      {
        type: 'callout',
        title: 'Your Statutory Rights',
        text: 'Nothing in these terms or policies limits any right you have under the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, or any other law that applies to you. Where a policy and the law differ, the law prevails.',
      },
      { type: 'heading', text: '1. Introduction and Acceptance' },
      {
        type: 'paragraph',
        text: `This Website is owned and operated by ${BRAND} ("${B.brandName}", "we", "us" or "our"), having its registered address at ${B.address} (GSTIN: ${B.gstin} · BIS Hallmarking Reg. No.: ${B.bisHallmarkRegNo}). "You" or "Customer" means any person who browses the Website or places an order.`,
      },
      {
        type: 'paragraph',
        text: 'By accessing the Website, creating an account or placing an order, you agree to be bound by these Terms and by our Privacy Policy, Returns & Exchange Policy, Refund Policy, Shipping & Delivery Policy, Cancellation Policy, and Warranty, Repair, Exchange & Buyback Policy, each of which forms part of these Terms. This document is an electronic record under the Information Technology Act, 2000 and does not require a physical or digital signature.',
      },
      { type: 'heading', text: '2. Eligibility, Account Security & KYC' },
      {
        type: 'paragraph',
        text: 'You must be at least 18 years old and capable of entering into a legally binding contract under Indian law to place an order. Minors may use the Website only under the supervision of a parent or legal guardian, who is responsible for the purchase.',
      },
      {
        type: 'paragraph',
        text: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Please notify us immediately of any unauthorised access. We may require Know Your Customer (KYC) documents — including photo identification, PAN Card, and proof of address — where required under applicable law for high-value, return, exchange, or buyback transactions.',
      },
      { type: 'heading', text: '3. Product Information, Hallmarking and Certification' },
      {
        type: 'paragraph',
        text: 'We take care to describe our products accurately, including metal, purity, gross and net weight, stone and diamond details, dimensions, and price. Photographs are for illustration; actual products may differ slightly in colour, shade, size, and finish due to lighting, screen settings, handcrafting, and natural characteristics.',
      },
      {
        type: 'paragraph',
        text: 'Gold jewellery sold by us is hallmarked in accordance with the Bureau of Indian Standards Act, 2016 and applicable hallmarking regulations, carrying the BIS mark, purity grade, and a six-character Hallmark Unique Identification (HUID) code (verifiable via the BIS Care app), except where exempted by law. Diamonds and gemstones are accompanied by a grading certificate only where the product page expressly states so, naming the issuing laboratory.',
      },
      { type: 'heading', text: '4. Pricing, Taxes & Order Formation' },
      {
        type: 'paragraph',
        text: 'All prices are in Indian Rupees (INR) and include or exclude taxes as clearly shown at checkout. Jewellery pricing reflects prevailing metal rates, weight, making charges, stone value, and applicable GST (3% under HSN 7113). A tax invoice is issued for every order. A binding contract is formed when we dispatch the product and send dispatch confirmation.',
      },
      {
        type: 'paragraph',
        text: 'If a material pricing or listing error affects your order, we will contact you before dispatch and offer you the option to proceed at the correct price or cancel with a full refund.',
      },
      { type: 'heading', text: '5. Payments' },
      {
        type: 'paragraph',
        text: `Online payments on checkout are integrated with Razorpay (an RBI-authorised payment aggregator), supporting UPI, Credit/Debit Cards, Net Banking, and supported Wallets when online checkout is enabled. ${B.brandName} does not store your full card details, CVV, PIN, or OTP, and will never ask you to share an OTP, PIN, CVV, or password by phone, email, or message.`,
      },
      {
        type: 'ownerConfirm',
        text: '[Owner to confirm]: Whether Cash on Delivery (COD) is offered alongside Razorpay online payments when online checkout is enabled.',
      },
      { type: 'heading', text: '6. Customised and Made-to-Order Products' },
      {
        type: 'paragraph',
        text: 'Customised, engraved, resized, and made-to-order products are crafted specifically for you. Specifications, price, estimated production time, and any special cancellation or return conditions are disclosed before payment and do not limit your statutory rights if a product is defective or misdescribed.',
      },
      { type: 'heading', text: '7. Acceptable Use & Intellectual Property' },
      {
        type: 'paragraph',
        text: `All Website content — including the ${B.brandName} name and logo, jewellery designs, photographs, text, graphics, and layout — is owned by ${B.legalName} or its licensors. You may not use the Website for unlawful purposes, automated scraping, impersonation, or unauthorised commercial reproduction.`,
      },
      { type: 'heading', text: '8. Governing Law and Dispute Resolution' },
      {
        type: 'paragraph',
        text: `These Terms are governed by the laws of India. Subject to your statutory rights under the Consumer Protection Act, 2019 to approach the appropriate Consumer Disputes Redressal Commission, the courts at ${B.jurisdiction} have jurisdiction over disputes arising from these Terms. You may also contact our Grievance Officer (${B.grievanceOfficer.name}, ${B.grievanceOfficer.email}, ${B.grievanceOfficer.phone}) or the National Consumer Helpline (1915 / consumerhelpline.gov.in).`,
      },
    ],
  },

  'privacy-policy': {
    slug: 'privacy-policy',
    partLabel: 'Part II',
    title: 'Privacy Policy',
    subtitle: `In line with the Digital Personal Data Protection Act, 2023 & IT Act, 2000 · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      { type: 'heading', text: '1. Who We Are' },
      {
        type: 'paragraph',
        text: `${BRAND}, of ${B.address}, decides why and how your personal data is processed and is the "Data Fiduciary" for the purposes of this policy. For privacy questions, write to ${B.supportEmail}.`,
      },
      { type: 'heading', text: '2. Personal Data We Collect' },
      {
        type: 'list',
        items: [
          'Identity and contact data: name, phone number, email address, billing and delivery addresses.',
          'Order and transaction data: products purchased, order value, payment status and references (card and bank credentials are handled by our payment provider, not stored by us).',
          'Verification data: PAN or identity details only where required by law for high-value transactions.',
          'Communications: messages, reviews, photographs, and queries sent to customer support.',
          'Technical data: IP address, device and browser type, pages viewed, and cookie identifiers.',
        ],
      },
      { type: 'heading', text: '3. Why We Use Your Data & Consent' },
      {
        type: 'paragraph',
        text: 'We process your personal data to process, deliver, and invoice orders; verify identity and prevent fraud; provide support, returns, refunds, repairs, and warranty service; maintain tax and legal records; and improve Website security. Where we rely on consent (such as promotional messages or non-essential cookies), you may withdraw consent at any time by writing to ' + B.supportEmail + '.',
      },
      { type: 'heading', text: '4. Cookies, Sharing & Retention' },
      {
        type: 'paragraph',
        text: 'Essential cookies keep your bag, session, and security working. We do not sell your personal data. We share data only as necessary under confidentiality obligations with hosting providers, RBI-authorised payment gateways, courier partners, and regulatory authorities where legally required. Data is retained only as long as needed for order fulfilment, tax/accounting laws, warranty, and dispute periods.',
      },
      { type: 'heading', text: '5. Security & Your Rights (DPDP Act, 2023)' },
      {
        type: 'list',
        items: [
          'Obtain a summary of personal data processed and entities with whom it has been shared.',
          'Request correction, completion, or updating of your personal data.',
          'Request erasure of your data, unless retention is required by law.',
          'Withdraw consent at any time and nominate another person to exercise rights in the event of death or incapacity.',
        ],
      },
      {
        type: 'paragraph',
        text: `To exercise any right, write to ${B.supportEmail}. If you are not satisfied with our response, you may contact our Grievance Officer (${B.grievanceOfficer.name}, ${B.grievanceOfficer.email}, ${B.grievanceOfficer.phone}) and thereafter approach the Data Protection Board of India.`,
      },
    ],
  },

  'return-policy': {
    slug: 'return-policy',
    partLabel: 'Part III',
    title: 'Returns & Exchange Policy',
    subtitle: `7-Day Return & Exchange Window · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      { type: 'heading', text: '1. Return and Exchange Window' },
      {
        type: 'paragraph',
        text: 'You may request a return or exchange within 7 calendar days of delivery.',
      },
      {
        type: 'table',
        headers: ['Situation', 'What You Can Request', 'Time Limit'],
        rows: [
          [
            'Damaged, defective, wrong item, or materially different from description',
            'Replacement, exchange, or full refund',
            'Report within 7 days of delivery',
          ],
          [
            'Change of mind on a standard, unworn product',
            'Exchange for another product, or refund as per Refund Policy',
            'Within 7 days of delivery',
          ],
          [
            'Manufacturing defect found later',
            'Repair or exchange under the Warranty Policy',
            'Within 12-month warranty period',
          ],
        ],
      },
      { type: 'heading', text: '2. Conditions for Return' },
      {
        type: 'paragraph',
        text: 'To be accepted, returned items must ordinarily be unused, unworn, and unaltered, with original packaging, hallmark and HUID details, grading certificates, tags, accessories, and the original tax invoice. These conditions do not apply where an item arrived damaged, defective, incorrect, or misdescribed.',
      },
      { type: 'heading', text: '3. Items That Cannot Be Returned' },
      {
        type: 'list',
        items: [
          'Gold and silver coins, bars, and bullion.',
          'Customised, engraved, resized, and made-to-order products where clearly disclosed before purchase.',
          'Items worn, damaged after delivery, altered, repaired, or resized by anyone other than us.',
          'Items returned without the original invoice or with tags, hallmark details, or certificates removed or tampered with.',
        ],
      },
      {
        type: 'ownerConfirm',
        text: '[Owner to confirm]: Whether pierced jewellery (such as earrings and nose pins) is excluded from change-of-mind returns on grounds of hygiene.',
      },
      { type: 'heading', text: '4. How to Request & Inspection Timeline' },
      {
        type: 'paragraph',
        text: `Write to ${B.supportEmail} or call ${B.supportPhone} (${B.supportHours}) with your order number, delivery date, reason, and clear photographs (and an unboxing video where available). Please do not send items before receiving return approval and instructions. We review requests within 2 business days and inspect returned items within 3 business days of receipt.`,
      },
    ],
  },

  'refund-policy': {
    slug: 'refund-policy',
    partLabel: 'Part IV',
    title: 'Refund Policy',
    subtitle: `Transparent Timelines & Full-Method Refunds · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      { type: 'heading', text: '1. When a Refund Is Issued' },
      {
        type: 'paragraph',
        text: 'Refunds are issued for: (a) orders cancelled before dispatch under the Cancellation Policy; (b) orders we are unable to fulfil; (c) approved returns of damaged, defective, incorrect, or misdescribed items; and (d) approved change-of-mind returns within 7 days of delivery.',
      },
      { type: 'heading', text: '2. Refund Method' },
      {
        type: 'paragraph',
        text: 'Approved refunds are credited to the original payment method. Where a refund to the original method is not possible, we will agree a lawful alternative such as a bank transfer or store credit. We will never ask for an OTP, PIN, CVV, or password to issue a refund.',
      },
      {
        type: 'ownerConfirm',
        text: '[Owner to confirm]: Whether Cash on Delivery (COD) is offered; if offered, COD refunds are processed via bank transfer after collecting bank account details.',
      },
      { type: 'heading', text: '3. Refund Timeline' },
      {
        type: 'table',
        headers: ['Stage', 'Timeline'],
        rows: [
          ['Review of your return or cancellation request', 'Within 2 business days'],
          ['Inspection of the returned item', 'Within 3 business days of receipt'],
          ['Refund initiated by us', 'Within 7 business days of approval'],
          ['Credit to your account or card', '5–10 business days thereafter, depending on your bank/provider'],
        ],
      },
      { type: 'heading', text: '4. Shipping Charges and Deductions' },
      {
        type: 'paragraph',
        text: `Delivery charges are refunded in full where the refund is due to our error, a damaged/defective item, a wrong item, or an order we cancel. For a voluntary change-of-mind return, the original delivery charge may be non-refundable only if clearly disclosed at checkout. If you have not received a refund within the stated timeline, contact ${B.supportEmail} with your order number.`,
      },
    ],
  },

  'shipping-policy': {
    slug: 'shipping-policy',
    partLabel: 'Part V',
    title: 'Shipping & Delivery Policy',
    subtitle: `India-Only Delivery & Tamper-Evident Packaging · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      { type: 'heading', text: '1. Delivery Areas' },
      {
        type: 'paragraph',
        text: 'We deliver across India to pin codes serviceable by our courier partners, verified at checkout. If your location is not serviceable, we will inform you and refund any amount paid.',
      },
      { type: 'heading', text: '2. Processing and Delivery Time' },
      {
        type: 'table',
        headers: ['Order Type', 'Dispatch', 'Estimated Delivery'],
        rows: [
          ['Ready-to-ship products', 'Within 1–2 business days', '3–7 business days after dispatch'],
          ['Made-to-order and customised products', '10–15 business days', 'As confirmed at order'],
          ['Gold and silver coins and bars', 'Within 2 business days', '3–7 business days after dispatch'],
        ],
      },
      { type: 'heading', text: '3. Packaging, Verification & Transit Insurance' },
      {
        type: 'paragraph',
        text: 'All jewellery shipments are packed in tamper-evident packaging. For security, delivery of high-value orders may require an OTP, signature, or valid photo identification of the recipient.',
      },
      {
        type: 'ownerConfirm',
        text: '[Owner to confirm]: Whether all shipments are fully insured against loss and damage in transit by default, or whether transit insurance is a separate charge shown at checkout.',
      },
      { type: 'heading', text: '4. Inspecting Your Parcel on Delivery' },
      {
        type: 'paragraph',
        text: `On delivery, please verify that the package is sealed and undamaged before accepting it. If packaging appears opened, tampered with, or damaged, do not accept it (or accept with a written remark on the courier receipt) and inform us within 24 hours at ${B.supportEmail} or ${B.supportPhone}. Recording a continuous unboxing video is recommended.`,
      },
    ],
  },

  'cancellation-policy': {
    slug: 'cancellation-policy',
    partLabel: 'Part VI',
    title: 'Cancellation Policy',
    subtitle: `Full Refund Before Dispatch · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      { type: 'heading', text: '1. Cancellation by You' },
      {
        type: 'paragraph',
        text: `You may cancel an order any time before it is dispatched by writing to ${B.supportEmail} or calling ${B.supportPhone} (${B.supportHours}) with your order number. You will receive a full refund of the amount paid with no cancellation fee.`,
      },
      {
        type: 'paragraph',
        text: 'An order cannot be cancelled once it has been dispatched (you may then use the 7-day Returns & Exchange Policy where eligible). Orders for gold and silver coins/bars, and made-to-order or customised products for which production has begun, cannot be cancelled once confirmed unless required by law.',
      },
      { type: 'heading', text: '2. Cancellation by Us' },
      {
        type: 'paragraph',
        text: 'We may cancel an order if an item is out of stock, a material pricing or listing error occurred, payment fails or cannot be verified, the delivery address is not serviceable, or fraud is reasonably suspected. We will notify you promptly and issue a full refund to your original payment method.',
      },
    ],
  },

  'lifetime-exchange': {
    slug: 'lifetime-exchange',
    partLabel: 'Part VII',
    title: 'Warranty, Repair, Exchange & Buyback',
    subtitle: `12-Month Manufacturing Warranty · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      { type: 'heading', text: '1. 12-Month Manufacturing Warranty' },
      {
        type: 'paragraph',
        text: 'Each jewellery piece is covered against manufacturing defects for 12 months from the date of purchase. This covers defects in workmanship and materials — such as faulty clasps, loose prongs or settings, and soldering failures arising under normal use — in addition to your statutory rights.',
      },
      {
        type: 'paragraph',
        text: 'The warranty does not cover accidental damage, loss or theft, misuse or improper care, chemical/heat/impact damage, normal wear and tear or gradual loss of plating/polish, or repairs/alterations carried out by anyone other than us.',
      },
      { type: 'heading', text: '2. Repair & Maintenance' },
      {
        type: 'paragraph',
        text: `To request a repair or service, write to ${B.supportEmail} with your order number and issue description. Please wait for instructions before sending jewellery. We will inspect the piece, explain repair options, timeline, and any applicable charges, and proceed only with your consent.`,
      },
      {
        type: 'ownerConfirm',
        text: '[Owner to confirm]: Whether free cleaning and polishing is offered for jewellery purchased from us.',
      },
      { type: 'heading', text: '3. Lifetime Exchange & Buyback' },
      {
        type: 'ownerConfirm',
        text: '[Owner to confirm]: Whether Lifetime Exchange and Buyback are offered on Mangal Royal Studio products, and confirm applicable valuation/deduction terms before enabling.',
      },
      {
        type: 'paragraph',
        text: 'Where exchange or buyback is offered, valuation is based on net metal weight and purity verified at the time of exchange/buyback at prevailing metal rates, plus stone/diamond valuation per certificate and condition, with any deductions disclosed in writing before you decide. Always retain your original tax invoice, hallmark/HUID details, and certificates.',
      },
    ],
  },

  'care-guide': {
    slug: 'care-guide',
    partLabel: 'Part VIII',
    title: 'Jewellery Care Guide',
    subtitle: `Preserve brilliance for generations · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      {
        type: 'table',
        headers: ['Material', 'Care Tips'],
        rows: [
          [
            'Gold',
            'Clean gently in lukewarm water with mild soap and a soft brush, rinse well and pat dry. Store separately as gold scratches easily.',
          ],
          [
            'Diamonds',
            'Soak in warm soapy water and brush softly behind the stone to remove oils. Check prongs and settings periodically.',
          ],
          [
            'Silver',
            'Polish with a soft silver cloth and store in an airtight pouch to slow tarnishing; avoid rubber, bleach, and sulphur.',
          ],
          [
            'Pearls',
            'Wipe with a soft damp cloth after wear. Never soak or use chemicals. Put pearls on last after perfume and make-up.',
          ],
          [
            'Gemstones',
            'Clean with a soft cloth and mild soap. Avoid steam, ultrasonic cleaners, and sudden temperature changes.',
          ],
        ],
      },
      { type: 'heading', text: 'General Care Recommendations' },
      {
        type: 'list',
        items: [
          'Store each piece separately in a clean, dry pouch or box to prevent scratches and tangling.',
          'Keep away from perfume, hairspray, cosmetics, household cleaners, chlorine, and abrasives.',
          'Remove jewellery before swimming, bathing, exercising, sleeping, or cooking.',
          'Have clasps, prongs, and settings checked by a qualified jeweller at least once a year.',
          'Keep tax invoices, grading certificates, and hallmark/HUID details in a safe place.',
        ],
      },
    ],
  },

  'grievance-redressal': {
    slug: 'grievance-redressal',
    partLabel: 'Part IX',
    title: 'Contact & Grievance Redressal',
    subtitle: `Consumer Protection (E-Commerce) Rules, 2020 & IT Act, 2000 · Effective ${B.effectiveDate}`,
    effectiveDate: B.effectiveDate,
    blocks: [
      { type: 'heading', text: 'Customer Support' },
      {
        type: 'table',
        headers: ['Field', 'Details'],
        rows: [
          ['Business', `${B.legalName} (${B.brandName})`],
          ['Registered Address', B.address],
          ['GSTIN / BIS Reg. No.', `${B.gstin} · ${B.bisHallmarkRegNo}`],
          ['Email', B.supportEmail],
          ['Phone', B.supportPhone],
          ['Support Hours', `${B.supportHours} IST`],
        ],
      },
      { type: 'heading', text: 'Grievance Officer' },
      {
        type: 'table',
        headers: ['Field', 'Details'],
        rows: [
          ['Name & Designation', `${B.grievanceOfficer.name} (${B.grievanceOfficer.designation})`],
          ['Email', B.grievanceOfficer.email],
          ['Phone', B.grievanceOfficer.phone],
          ['Postal Address', B.address],
        ],
      },
      {
        type: 'paragraph',
        text: 'We will acknowledge your complaint within 48 hours and aim to resolve it within one month of receipt. Please quote your order number and describe your concern so we can assist promptly.',
      },
      { type: 'heading', text: 'Escalation Channels' },
      {
        type: 'list',
        items: [
          'National Consumer Helpline: toll-free 1915 or consumerhelpline.gov.in',
          'Appropriate Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019',
          'Data Protection Board of India for privacy concerns under the Digital Personal Data Protection Act, 2023',
          'Bureau of Indian Standards (BIS) via the BIS Care app for hallmarking concerns',
        ],
      },
    ],
  },
};

export const POLICY_ALIASES: Record<string, string> = {
  'refund-policy': 'refund-policy',
  'return-policy': 'return-policy',
  'shipping-policy': 'shipping-policy',
  'cancellation-policy': 'cancellation-policy',
  'privacy-policy': 'privacy-policy',
  'terms-of-service': 'terms-of-service',
  'terms-and-conditions': 'terms-of-service',
  'warranty-policy': 'lifetime-exchange',
  'lifetime-exchange': 'lifetime-exchange',
  'care-guide': 'care-guide',
  'grievance-redressal': 'grievance-redressal',
};
