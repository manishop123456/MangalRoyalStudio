import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  OrderRecord,
  PaymentRecordItem,
  RefundRecordItem,
  ShipmentRecord,
} from '../../store/data-store.js';
import { getPrismaClient } from '../prisma.js';

export interface CreateOrderParams {
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  customerId?: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingAddressJson: Record<string, unknown> | Prisma.InputJsonValue;
  subtotalPriceInr: number | string;
  totalTaxInr: number | string;
  totalPriceInr: number | string;
  discountAmountInr?: number | string;
  discountCode?: string | null;
  lineItems: Array<{
    sku: string;
    title: string;
    quantity: number;
    purchaseTimePriceInr: number | string;
    metalPurity?: string;
    diamondCarats?: string;
    pricingSnapshotId?: string;
    customizationSnapshot?: unknown[];
    customerDesignId?: string;
  }>;
  razorpayOrderId?: string;
  paymentGateway?: string;
  idempotencyKey?: string;
  auditActorEmail?: string;
  auditActorRole?: string;
}

const orderInclude = {
  items: true,
  payments: true,
  refunds: true,
  shipments: true,
} satisfies Prisma.OrderMetadataInclude;

type OrderWithRelations = Prisma.OrderMetadataGetPayload<{
  include: typeof orderInclude;
}>;

export function mapOrderToRecord(o: OrderWithRelations): OrderRecord {
  const addr = (o.shippingAddressJson || {}) as Record<string, unknown>;
  const meta = (o.pricingSnapshotsJson || {}) as Record<string, unknown>;
  const lineSnapshot = Array.isArray(o.lineItemsSnapshot)
    ? (o.lineItemsSnapshot as Array<Record<string, unknown>>)
    : [];
  const capturedPayment = o.payments.find((p) => p.status === 'CAPTURED' || p.status === 'REFUNDED') || o.payments[0];

  return {
    id: o.id,
    shopifyOrderGid: o.shopifyOrderGid || undefined,
    orderNumber: o.orderNumber,
    customerId: o.customerId || 'cust-guest',
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone || '',
    shippingCity: String(addr.city || ''),
    shippingState: String(addr.state || ''),
    shippingPincode: String(addr.pincode || ''),
    totalPriceInr: o.totalPriceInr.toFixed(2),
    subtotalPriceInr: o.subtotalPriceInr.toFixed(2),
    totalTaxInr: o.totalTaxInr.toFixed(2),
    financialStatus: o.financialStatus as OrderRecord['financialStatus'],
    fulfillmentStatus: o.fulfillmentStatus as OrderRecord['fulfillmentStatus'],
    paymentGateway: String(meta.paymentGateway || capturedPayment?.provider || 'RAZORPAY'),
    idempotencyKey: o.idempotencyKey || undefined,
    razorpayOrderId:
      typeof meta.razorpayOrderId === 'string'
        ? meta.razorpayOrderId
        : capturedPayment?.providerOrderId || undefined,
    razorpayPaymentId: capturedPayment?.providerPaymentId || undefined,
    lineItems:
      o.items.length > 0
        ? o.items.map((item) => {
            const snap = lineSnapshot.find((s) => s.sku === item.sku);
            return {
              sku: item.sku,
              title: item.title,
              quantity: item.quantity,
              purchaseTimePriceInr: item.unitPriceInr.toFixed(2),
              metalPurity: item.metalPurity || '18K',
              diamondCarats: String(snap?.diamondCarats || '0.000'),
              pricingSnapshotId: String(snap?.pricingSnapshotId || 'snap-immutable'),
              customizationSnapshot: Array.isArray(item.customizationSnapshotJson)
                ? (item.customizationSnapshotJson as unknown[])
                : undefined,
              customerDesignId: item.customerDesignId || undefined,
            };
          })
        : lineSnapshot.map((s) => ({
            sku: String(s.sku || ''),
            title: String(s.title || ''),
            quantity: Number(s.quantity || 1),
            purchaseTimePriceInr: String(s.purchaseTimePriceInr || '0.00'),
            metalPurity: String(s.metalPurity || '18K'),
            diamondCarats: String(s.diamondCarats || '0.000'),
            pricingSnapshotId: String(s.pricingSnapshotId || 'snap-immutable'),
          })),
    placedAt: o.placedAt.toISOString(),
  };
}

export class PostgresOrderRepository {
  constructor(private prisma: PrismaClient = getPrismaClient()) {}

  async listOrders(): Promise<OrderRecord[]> {
    const rows = await this.prisma.orderMetadata.findMany({
      include: orderInclude,
      orderBy: { placedAt: 'desc' },
    });
    return rows.map(mapOrderToRecord);
  }

  async findOrderByIdOrNumber(orderIdOrNumber: string): Promise<OrderRecord | null> {
    const key = orderIdOrNumber.trim();
    const row = await this.prisma.orderMetadata.findFirst({
      where: {
        OR: [{ id: key }, { orderNumber: key }],
      },
      include: orderInclude,
    });
    return row ? mapOrderToRecord(row) : null;
  }

  async findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | null> {
    const key = idempotencyKey.trim();
    if (!key) return null;
    const row = await this.prisma.orderMetadata.findUnique({
      where: { idempotencyKey: key },
      include: orderInclude,
    });
    return row ? mapOrderToRecord(row) : null;
  }

  async attachRazorpayOrderToOrder(params: {
    orderId: string;
    razorpayOrderId: string;
    actorEmail?: string;
    actorRole?: string;
  }): Promise<OrderRecord> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.orderMetadata.findFirst({
        where: { OR: [{ id: params.orderId }, { orderNumber: params.orderId }] },
      });
      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
      }
      if (order.financialStatus === 'PAID') {
        throw new Error('ORDER_ALREADY_PAID: Cannot create a new payment order for a paid order.');
      }
      const existingMeta =
        order.pricingSnapshotsJson && typeof order.pricingSnapshotsJson === 'object'
          ? (order.pricingSnapshotsJson as Record<string, unknown>)
          : {};
      const nextMeta = {
        ...existingMeta,
        paymentGateway: existingMeta.paymentGateway || 'Razorpay Secure Checkout',
        razorpayOrderId: params.razorpayOrderId,
      };
      const nextOrder = await tx.orderMetadata.update({
        where: { id: order.id },
        data: {
          pricingSnapshotsJson: nextMeta as Prisma.InputJsonValue,
        },
        include: orderInclude,
      });
      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail || order.customerEmail,
          actorRole: params.actorRole || 'CUSTOMER',
          action: 'RAZORPAY_ORDER_ATTACHED',
          entityType: 'OrderMetadata',
          entityId: order.id,
          summary: `Attached Razorpay order ${params.razorpayOrderId} to ${order.orderNumber}`,
          afterData: { razorpayOrderId: params.razorpayOrderId },
        },
      });
      return nextOrder;
    });
    return mapOrderToRecord(updated);
  }

  async recordPaymentAttemptStatus(params: {
    orderId: string;
    providerPaymentId: string;
    providerOrderId?: string;
    amountInr: number | string;
    status: 'AUTHORIZED' | 'FAILED';
    method?: string;
    failureReason?: string;
    webhookEventId?: string;
    actorEmail?: string;
    actorRole?: string;
  }): Promise<{ recorded: boolean; ignoredReason?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderMetadata.findFirst({
        where: { OR: [{ id: params.orderId }, { orderNumber: params.orderId }] },
      });
      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
      }
      if (order.financialStatus === 'PAID') {
        return { recorded: false, ignoredReason: 'already_paid' };
      }

      const existingPayment = await tx.paymentRecord.findUnique({
        where: { providerPaymentId: params.providerPaymentId },
      });
      if (existingPayment && existingPayment.orderMetadataId !== order.id) {
        throw new Error('PAYMENT_ALREADY_ASSOCIATED: This payment ID is already linked to another order.');
      }
      if (existingPayment && existingPayment.status === 'CAPTURED') {
        return { recorded: false, ignoredReason: 'already_captured' };
      }

      if (existingPayment) {
        await tx.paymentRecord.update({
          where: { id: existingPayment.id },
          data: {
            status: params.status,
            method: params.method || existingPayment.method,
            failureReason: params.failureReason || existingPayment.failureReason,
            webhookEventId: params.webhookEventId || existingPayment.webhookEventId,
          },
        });
      } else {
        await tx.paymentRecord.create({
          data: {
            orderMetadataId: order.id,
            provider: 'RAZORPAY',
            providerOrderId: params.providerOrderId || null,
            providerPaymentId: params.providerPaymentId,
            amountInr: Number(params.amountInr),
            currency: 'INR',
            method: params.method || 'unknown',
            status: params.status,
            signatureVerified: true,
            failureReason: params.failureReason || null,
            webhookEventId: params.webhookEventId || null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail || order.customerEmail,
          actorRole: params.actorRole || 'SYSTEM',
          action: params.status === 'AUTHORIZED' ? 'PAYMENT_AUTHORIZED' : 'PAYMENT_FAILED',
          entityType: 'OrderMetadata',
          entityId: order.id,
          summary: `Recorded ${params.status} payment ${params.providerPaymentId} for ${order.orderNumber}`,
          afterData: {
            providerPaymentId: params.providerPaymentId,
            status: params.status,
            failureReason: params.failureReason || null,
          },
        },
      });

      return { recorded: true };
    });
  }

  async listOrdersByCustomer(customerId: string, email: string): Promise<OrderRecord[]> {
    const normalizedEmail = email.trim().toLowerCase();
    const rows = await this.prisma.orderMetadata.findMany({
      where: {
        OR: [{ customerId }, { customerEmail: { equals: normalizedEmail, mode: 'insensitive' } }],
      },
      include: orderInclude,
      orderBy: { placedAt: 'desc' },
    });
    return rows.map(mapOrderToRecord);
  }

  /**
   * Transactional order creation with inventory reservation.
   * If stock is insufficient, the transaction throws INSUFFICIENT_STOCK and rolls back completely.
   */
  async createOrderWithInventoryReservation(params: CreateOrderParams) {
    return this.prisma.$transaction(async (tx) => {
      const productIdBySku = new Map<string, string>();

      // 1. Verify and reserve stock for each line item
      for (const item of params.lineItems) {
        const product = await tx.productMetadata.findUnique({
          where: { sku: item.sku },
          include: { inventoryRecord: true },
        });

        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND: SKU "${item.sku}" does not exist.`);
        }
        productIdBySku.set(item.sku, product.id);

        const inv = product.inventoryRecord;
        if (!inv || inv.availableQuantity < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: SKU "${item.sku}" has ${inv?.availableQuantity ?? 0} available, cannot reserve ${item.quantity}.`
          );
        }

        const prevQty = inv.availableQuantity;
        const newQty = prevQty - item.quantity;
        await tx.inventoryRecord.update({
          where: { id: inv.id },
          data: {
            availableQuantity: newQty,
            reservedQuantity: inv.reservedQuantity + item.quantity,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryRecordId: inv.id,
            sku: item.sku,
            movementType: 'ORDER_RESERVED',
            quantityDelta: -item.quantity,
            previousQuantity: prevQty,
            newQuantity: newQty,
            reason: `Order ${params.orderNumber} reservation`,
            actorEmail: params.customerEmail,
          },
        });
      }

      const shippingAddress = {
        ...(typeof params.shippingAddressJson === 'object' && params.shippingAddressJson !== null
          ? (params.shippingAddressJson as Record<string, unknown>)
          : {}),
        city: params.shippingCity,
        state: params.shippingState,
        pincode: params.shippingPincode,
      };

      const pricingMeta = {
        paymentGateway: params.paymentGateway || 'RAZORPAY',
        razorpayOrderId: params.razorpayOrderId || null,
      };

      // 2. Create OrderMetadata and OrderItems
      const order = await tx.orderMetadata.create({
        data: {
          orderNumber: params.orderNumber,
          customerEmail: params.customerEmail.trim().toLowerCase(),
          customerName: params.customerName.trim(),
          customerPhone: params.customerPhone,
          customerId: params.customerId || null,
          subtotalPriceInr: Number(params.subtotalPriceInr),
          totalTaxInr: Number(params.totalTaxInr),
          totalPriceInr: Number(params.totalPriceInr),
          discountAmountInr: Number(params.discountAmountInr ?? 0),
          discountCode: params.discountCode,
          idempotencyKey: params.idempotencyKey || null,
          financialStatus: 'PENDING',
          fulfillmentStatus: 'UNFULFILLED',
          lineItemsSnapshot: params.lineItems as unknown as Prisma.InputJsonValue,
          pricingSnapshotsJson: pricingMeta as Prisma.InputJsonValue,
          shippingAddressJson: shippingAddress as Prisma.InputJsonValue,
          items: {
            create: params.lineItems.map((item) => ({
              productMetadataId: productIdBySku.get(item.sku) || null,
              sku: item.sku,
              title: item.title,
              quantity: item.quantity,
              unitPriceInr: Number(item.purchaseTimePriceInr),
              totalPriceInr: Number(item.purchaseTimePriceInr) * item.quantity,
              metalPurity: item.metalPurity || '18K',
              customizationSnapshotJson:
                item.customizationSnapshot !== undefined
                  ? (item.customizationSnapshot as Prisma.InputJsonValue)
                  : undefined,
              customerDesignId: item.customerDesignId || null,
            })),
          },
        },
        include: orderInclude,
      });

      if (params.discountCode) {
        await tx.discount.updateMany({
          where: { code: params.discountCode, isActive: true },
          data: { usageCount: { increment: 1 } },
        });
      }

      if (params.customerId) {
        await tx.customer.updateMany({
          where: { id: params.customerId },
          data: {
            totalOrdersCount: { increment: 1 },
            totalSpentInr: { increment: Number(params.totalPriceInr) },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorEmail: params.auditActorEmail || params.customerEmail.trim().toLowerCase(),
          actorRole: params.auditActorRole || (params.customerId ? 'CUSTOMER' : 'SYSTEM'),
          action: 'ORDER_CREATED',
          entityType: 'OrderMetadata',
          entityId: order.id,
          summary: `Created order ${order.orderNumber} (₹${Number(params.totalPriceInr).toFixed(2)})`,
          afterData: {
            orderNumber: order.orderNumber,
            totalPriceInr: Number(params.totalPriceInr),
            itemCount: params.lineItems.length,
          },
        },
      });

      return order;
    });
  }

  /**
   * Transactional payment capture confirmation.
   * Prevents double payment and marks order PAID.
   */
  async confirmPaymentCapture(params: {
    orderId: string;
    providerPaymentId: string;
    providerOrderId?: string;
    providerSignature?: string;
    amountInr: number | string;
    method?: string;
    webhookEventId?: string;
    actorEmail?: string;
    actorRole?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderMetadata.findFirst({
        where: { OR: [{ id: params.orderId }, { orderNumber: params.orderId }] },
        include: { payments: true },
      });

      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
      }

      if (order.financialStatus === 'PAID') {
        const existing = order.payments.find((p) => p.providerPaymentId === params.providerPaymentId);
        if (existing) {
          return { order, payment: existing, idempotent: true };
        }
        throw new Error('ORDER_ALREADY_PAID: Order already paid under a different payment reference.');
      }

      const duplicatePayment = await tx.paymentRecord.findUnique({
        where: { providerPaymentId: params.providerPaymentId },
      });
      if (duplicatePayment && duplicatePayment.orderMetadataId !== order.id) {
        throw new Error('PAYMENT_ALREADY_ASSOCIATED: This payment ID is already linked to another order.');
      }

      const payment = duplicatePayment
        ? await tx.paymentRecord.update({
            where: { id: duplicatePayment.id },
            data: {
              providerOrderId: params.providerOrderId || duplicatePayment.providerOrderId,
              providerSignature: params.providerSignature || duplicatePayment.providerSignature,
              amountInr: Number(params.amountInr),
              method: params.method || duplicatePayment.method || 'upi',
              status: 'CAPTURED',
              signatureVerified: true,
              webhookEventId: params.webhookEventId || duplicatePayment.webhookEventId,
              failureReason: null,
              capturedAt: new Date(),
            },
          })
        : await tx.paymentRecord.create({
            data: {
              orderMetadataId: order.id,
              provider: 'RAZORPAY',
              providerOrderId: params.providerOrderId || null,
              providerPaymentId: params.providerPaymentId,
              providerSignature: params.providerSignature || null,
              amountInr: Number(params.amountInr),
              currency: 'INR',
              method: params.method || 'upi',
              status: 'CAPTURED',
              signatureVerified: true,
              webhookEventId: params.webhookEventId || null,
              capturedAt: new Date(),
            },
          });

      const updatedOrder = await tx.orderMetadata.update({
        where: { id: order.id },
        data: { financialStatus: 'PAID' },
        include: orderInclude,
      });

      await tx.notification.create({
        data: {
          channel: 'EMAIL',
          recipientEmail: order.customerEmail,
          subject: `Payment Received for ${order.orderNumber} — Mangal Royal Studio`,
          body: `Your payment of ₹${Number(params.amountInr).toFixed(2)} (${params.providerPaymentId}) has been verified.`,
          eventType: 'PAYMENT_RECEIPT',
          status: 'SENT',
          referenceId: order.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail || order.customerEmail,
          actorRole: params.actorRole || 'SYSTEM',
          action: 'PAYMENT_CAPTURED',
          entityType: 'OrderMetadata',
          entityId: order.id,
          summary: `Verified Razorpay payment ${params.providerPaymentId} for ${order.orderNumber}`,
          afterData: {
            providerPaymentId: params.providerPaymentId,
            amountInr: Number(params.amountInr),
          },
        },
      });

      return { order: updatedOrder, payment, idempotent: false };
    });
  }

  /**
   * Transactional order cancellation with stock restock.
   */
  async cancelOrderWithRestock(
    orderId: string,
    actorEmail: string,
    cancelReason = 'Customer cancellation',
    actorRole = 'CUSTOMER'
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderMetadata.findFirst({
        where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
        include: { items: true },
      });

      if (!order) throw new Error(`ORDER_NOT_FOUND: ${orderId}`);

      if (order.fulfillmentStatus === 'CANCELLED') {
        return { order, idempotent: true };
      }

      if (['SHIPPED', 'DELIVERED', 'FULFILLED', 'IN_TRANSIT'].includes(order.fulfillmentStatus)) {
        throw new Error(
          `ORDER_NOT_CANCELLABLE: Cannot cancel order in status "${order.fulfillmentStatus}".`
        );
      }

      for (const item of order.items) {
        const product = await tx.productMetadata.findUnique({
          where: { sku: item.sku },
          include: { inventoryRecord: true },
        });

        if (product?.inventoryRecord) {
          const inv = product.inventoryRecord;
          const prevQty = inv.availableQuantity;
          const newQty = prevQty + item.quantity;
          const newReserved = Math.max(0, inv.reservedQuantity - item.quantity);

          await tx.inventoryRecord.update({
            where: { id: inv.id },
            data: {
              availableQuantity: newQty,
              reservedQuantity: newReserved,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              inventoryRecordId: inv.id,
              sku: item.sku,
              movementType: 'ORDER_CANCELLED',
              quantityDelta: item.quantity,
              previousQuantity: prevQty,
              newQuantity: newQty,
              reason: `Order ${order.orderNumber} restock on cancellation`,
              referenceId: order.id,
              actorEmail,
            },
          });
        }
      }

      const cancelledOrder = await tx.orderMetadata.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason,
        },
        include: orderInclude,
      });

      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'ORDER_CANCELLED',
          entityType: 'OrderMetadata',
          entityId: order.id,
          summary: `Cancelled order ${order.orderNumber} and restored stock`,
          afterData: { cancelReason, restoredItems: order.items.length },
        },
      });

      return { order: cancelledOrder, idempotent: false };
    });
  }

  async updateOrderStatus(params: {
    orderId: string;
    newStatus: string;
    reason?: string;
    actorEmail: string;
    actorRole: string;
    trackingNumber?: string;
    carrier?: string;
  }): Promise<OrderRecord> {
    const { orderId, newStatus, reason, actorEmail, actorRole } = params;
    if (newStatus === 'CANCELLED') {
      const res = await this.cancelOrderWithRestock(
        orderId,
        actorEmail,
        reason || 'Status transition to CANCELLED',
        actorRole
      );
      const full = await this.findOrderByIdOrNumber(orderId);
      return full!;
    }
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderMetadata.findFirst({
        where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
        include: orderInclude,
      });
      if (!order) throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
      if (order.fulfillmentStatus === 'CANCELLED') {
        throw new Error('INVALID_STATE_TRANSITION: Cannot transition cancelled order.');
      }
      if (order.fulfillmentStatus === 'DELIVERED') {
        throw new Error('INVALID_STATE_TRANSITION: Cannot transition delivered order.');
      }
      const previous = order.fulfillmentStatus;
      const updated = await tx.orderMetadata.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: newStatus,
          notes: reason || order.notes,
        },
        include: orderInclude,
      });
      await tx.auditLog.create({
        data: {
          actorEmail,
          actorRole,
          action: 'ORDER_STATUS_UPDATED',
          entityType: 'OrderMetadata',
          entityId: order.id,
          summary: `Transitioned order ${order.orderNumber} status from ${previous} to ${newStatus}`,
        },
      });
      return mapOrderToRecord(updated);
    });
  }

  async createRefund(params: {
    orderId: string;
    amountInr: number;
    reason: string;
    initiatedByEmail: string;
    initiatedByRole: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderMetadata.findFirst({
        where: { OR: [{ id: params.orderId }, { orderNumber: params.orderId }] },
        include: { payments: true, refunds: true },
      });
      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
      }

      if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.financialStatus)) {
        throw new Error(
          `ORDER_NOT_REFUNDABLE: Order ${order.orderNumber} has financialStatus "${order.financialStatus}".`
        );
      }

      const payment = order.payments.find((p) => p.status === 'CAPTURED' || p.status === 'PARTIALLY_REFUNDED');
      if (!payment) {
        throw new Error(`PAYMENT_NOT_FOUND: No captured payment found for order ${order.orderNumber}.`);
      }

      const alreadyRefunded = order.refunds
        .filter((r) => r.status === 'PROCESSED')
        .reduce((sum, r) => sum + Number(r.amountInr), 0);
      const orderTotal = Number(order.totalPriceInr);
      const remainingRefundable = Number((orderTotal - alreadyRefunded).toFixed(2));

      if (params.amountInr <= 0 || params.amountInr > remainingRefundable) {
        throw new Error(
          `REFUND_EXCEEDS_BALANCE: Requested ₹${params.amountInr.toFixed(2)} exceeds refundable balance ₹${remainingRefundable.toFixed(2)}.`
        );
      }

      const providerRefundId = `rfnd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const refund = await tx.refundRecord.create({
        data: {
          orderMetadataId: order.id,
          paymentRecordId: payment.id,
          providerRefundId,
          amountInr: params.amountInr,
          currency: 'INR',
          reason: params.reason,
          status: 'PROCESSED',
          initiatedBy: params.initiatedByEmail,
          processedAt: new Date(),
        },
      });

      const newTotalRefunded = alreadyRefunded + params.amountInr;
      const newFinancialStatus =
        newTotalRefunded >= orderTotal - 0.01 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      const updatedOrder = await tx.orderMetadata.update({
        where: { id: order.id },
        data: { financialStatus: newFinancialStatus },
        include: orderInclude,
      });

      await tx.paymentRecord.update({
        where: { id: payment.id },
        data: { status: newFinancialStatus === 'REFUNDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.initiatedByEmail,
          actorRole: params.initiatedByRole,
          action: 'ORDER_REFUNDED',
          entityType: 'RefundRecord',
          entityId: refund.id,
          summary: `Processed refund ${providerRefundId} of ₹${params.amountInr.toFixed(2)} for ${order.orderNumber}`,
          afterData: {
            orderId: order.id,
            amountInr: params.amountInr,
            financialStatus: newFinancialStatus,
          },
        },
      });

      return {
        refund: {
          id: refund.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentId: payment.id,
          providerRefundId: refund.providerRefundId,
          amountInr: refund.amountInr.toFixed(2),
          reason: refund.reason,
          status: refund.status as RefundRecordItem['status'],
          initiatedByEmail: refund.initiatedBy,
          processedAt: (refund.processedAt || refund.createdAt).toISOString(),
        },
        order: mapOrderToRecord(updatedOrder),
      };
    });
  }

  async listPayments(): Promise<PaymentRecordItem[]> {
    const rows = await this.prisma.paymentRecord.findMany({
      include: { orderMetadata: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      id: p.id,
      orderId: p.orderMetadataId,
      orderNumber: p.orderMetadata.orderNumber,
      provider: p.provider as PaymentRecordItem['provider'],
      providerPaymentId: p.providerPaymentId,
      amountInr: p.amountInr.toFixed(2),
      currency: 'INR',
      method: p.method || 'UPI / Card',
      status: p.status as PaymentRecordItem['status'],
      signatureVerified: p.signatureVerified,
      capturedAt: (p.capturedAt || p.createdAt).toISOString(),
    }));
  }

  async listRefunds(): Promise<RefundRecordItem[]> {
    const rows = await this.prisma.refundRecord.findMany({
      include: { orderMetadata: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderMetadataId,
      orderNumber: r.orderMetadata.orderNumber,
      paymentId: r.paymentRecordId,
      providerRefundId: r.providerRefundId,
      amountInr: r.amountInr.toFixed(2),
      reason: r.reason,
      status: r.status as RefundRecordItem['status'],
      initiatedByEmail: r.initiatedBy,
      processedAt: (r.processedAt || r.createdAt).toISOString(),
    }));
  }

  async listShipments(): Promise<ShipmentRecord[]> {
    const rows = await this.prisma.shipment.findMany({
      include: { orderMetadata: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => {
      const history = Array.isArray(s.trackingHistory)
        ? (s.trackingHistory as ShipmentRecord['trackingHistory'])
        : [];
      return {
        id: s.id,
        orderId: s.orderMetadataId,
        orderNumber: s.orderMetadata.orderNumber,
        shopifyOrderGid: s.shopifyOrderGid || undefined,
        provider: 'SHIPROCKET',
        shiprocketOrderId: s.shiprocketOrderId || '',
        shipmentId: s.shipmentId || '',
        awbCode: s.awbCode || '',
        courierName: s.courierName || '',
        declaredValueInr: s.declaredValueInr.toFixed(2),
        isInsured: s.isInsured,
        packageWeightGrams: s.packageWeightGrams.toFixed(2),
        labelUrl: s.labelUrl || '',
        manifestUrl: s.manifestUrl || '',
        trackingUrl: s.trackingUrl || '',
        status: s.status as ShipmentRecord['status'],
        latestMilestone: history[history.length - 1]?.remarks || s.status,
        trackingHistory: history,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    });
  }

  async createShipment(params: {
    orderId: string;
    shipment: ShipmentRecord;
    actorEmail: string;
    actorRole: string;
  }): Promise<ShipmentRecord> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderMetadata.findFirst({
        where: { OR: [{ id: params.orderId }, { orderNumber: params.orderId }] },
      });
      if (!order) {
        throw new Error(`ORDER_NOT_FOUND: ${params.orderId}`);
      }

      const created = await tx.shipment.create({
        data: {
          orderMetadataId: order.id,
          shopifyOrderGid: order.shopifyOrderGid,
          provider: 'SHIPROCKET',
          shiprocketOrderId: params.shipment.shiprocketOrderId,
          shipmentId: params.shipment.shipmentId,
          awbCode: params.shipment.awbCode,
          courierName: params.shipment.courierName,
          declaredValueInr: Number(params.shipment.declaredValueInr),
          isInsured: params.shipment.isInsured,
          packageWeightGrams: Number(params.shipment.packageWeightGrams),
          labelUrl: params.shipment.labelUrl,
          manifestUrl: params.shipment.manifestUrl,
          trackingUrl: params.shipment.trackingUrl,
          status: params.shipment.status,
          trackingHistory: params.shipment.trackingHistory as unknown as Prisma.InputJsonValue,
        },
        include: { orderMetadata: { select: { orderNumber: true } } },
      });

      await tx.orderMetadata.update({
        where: { id: order.id },
        data: { fulfillmentStatus: 'IN_TRANSIT' },
      });

      await tx.notification.create({
        data: {
          channel: 'EMAIL',
          recipientEmail: order.customerEmail,
          subject: `Shipment Dispatched for ${order.orderNumber}`,
          body: `Your jewellery order ${order.orderNumber} has been assigned AWB ${params.shipment.awbCode} via ${params.shipment.courierName}.`,
          eventType: 'SHIPMENT_DISPATCHED',
          status: 'SENT',
          referenceId: created.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: 'SHIPMENT_CREATED',
          entityType: 'Shipment',
          entityId: created.id,
          summary: `Created Shiprocket shipment AWB ${params.shipment.awbCode} for ${order.orderNumber}`,
          afterData: { awbCode: params.shipment.awbCode, courierName: params.shipment.courierName },
        },
      });

      return {
        ...params.shipment,
        id: created.id,
        orderId: order.id,
        orderNumber: created.orderMetadata.orderNumber,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    });
  }
}
