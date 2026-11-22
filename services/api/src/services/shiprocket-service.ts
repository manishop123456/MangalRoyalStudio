import type { OrderRecord, ShipmentRecord } from '../store/data-store.js';

export {
  assertRazorpayTestMode,
  buildRazorpayReceipt,
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayCredentials,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret,
  inrToPaise,
  redactRazorpayError,
  validateRazorpayConfig,
  verifyRazorpayCheckoutSignature,
  verifyRazorpaySignature,
  type RazorpayConfigStatus,
  type RazorpayOrderResponse,
  type RazorpayPaymentResponse,
} from './razorpay-service.js';

export interface CreateShiprocketShipmentInput {
  order: OrderRecord;
  courierName?: string;
  packageWeightGrams?: string;
  declaredValueInr?: string;
  isInsured?: boolean;
}

export function createShiprocketAwbShipment(input: CreateShiprocketShipmentInput): ShipmentRecord {
  const timestampSuffix = String(Date.now()).slice(-6);
  const shiprocketOrderId = `SR-ORD-${timestampSuffix}`;
  const shipmentId = `SR-SHP-${timestampSuffix}`;
  const awbCode = `SRMRS${timestampSuffix}IN`;
  const courierName = input.courierName || 'BlueDart Insured Jewellery Air';
  const now = new Date().toISOString();

  return {
    id: `ship-${Date.now()}`,
    orderId: input.order.id,
    orderNumber: input.order.orderNumber,
    shopifyOrderGid: input.order.shopifyOrderGid,
    provider: 'SHIPROCKET',
    shiprocketOrderId,
    shipmentId,
    awbCode,
    courierName,
    declaredValueInr: input.declaredValueInr || input.order.totalPriceInr,
    isInsured: input.isInsured ?? true,
    packageWeightGrams: input.packageWeightGrams || '120',
    labelUrl: `https://shiprocket.co/labels/${awbCode}.pdf`,
    manifestUrl: `https://shiprocket.co/manifests/${shipmentId}.pdf`,
    trackingUrl: `https://shiprocket.co/tracking/${awbCode}`,
    status: 'AWB_ASSIGNED',
    latestMilestone: 'AWB Assigned — Tamper-evident vault dispatch scheduled',
    trackingHistory: [
      {
        timestamp: now,
        location: 'Mangal Royal Studio Vault, Mumbai',
        status: 'AWB_ASSIGNED',
        remarks: `Assigned AWB ${awbCode} via ${courierName}`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
