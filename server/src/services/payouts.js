import prisma from "../config/prisma.js";
import { initiateTransfer, verifyTransfer } from "./paystack.js";

// Deterministic per (order, recipient type). It is both the idempotency key
// Paystack sees and the lock that makes concurrent settlements safe: the unique
// constraint on Payout.reference lets exactly one insert win per payout.
const payoutReference = (orderId, type, attempt = 1) =>
  attempt === 1
    ? `CHOW-TRF-${orderId}-${type}`
    : `CHOW-TRF-${orderId}-${type}-R${attempt}`;

// Manual payouts by default: record what's owed (PENDING) without firing a
// transfer. Set AUTO_PAYOUTS=true once the Paystack account is a *Registered*
// Business to switch back to automatic transfers.
export const AUTO_PAYOUTS = process.env.AUTO_PAYOUTS === "true";

// Create one Payout row and (when bank details exist) fire the transfer.
// Returns null when there is nothing to pay out (zero/negative amount).
async function createAndRunPayout({
  orderId,
  type,
  riderId,
  amountNaira,
  recipientCode,
  reason,
  attempt = 1,
  holdForReview = false,
}) {
  if (amountNaira <= 0) return null;

  const reference = payoutReference(orderId, type, attempt);

  // Claim the payout BEFORE sending money. Two concurrent callers can both pass
  // the findFirst guard in settleOrderPayouts, but only one can insert this
  // reference — the loser gets P2002 and never calls Paystack.
  let payout;
  try {
    payout = await prisma.payout.create({
      data: {
        orderId,
        type,
        riderId: riderId || null,
        attempt,
        amount: amountNaira,
        recipientCode: recipientCode || null,
        reference,
        // Auto mode with no bank details: record the failure so the admin sees it.
        status: AUTO_PAYOUTS && !recipientCode ? "FAILED" : "PENDING",
        gatewayResponse: holdForReview
          ? {
              // Held rows are money owed, never an in-flight transfer. The
              // verifier skips state "held" so it cannot 404 them to FAILED.
              mode: AUTO_PAYOUTS ? "auto" : "manual",
              state: "held",
              reason: "Payout account needs admin review",
              bankDetails: recipientCode ? "complete" : "missing",
            }
          : !AUTO_PAYOUTS
            ? { mode: "manual", bankDetails: recipientCode ? "complete" : "missing" }
            : recipientCode
              ? { mode: "auto", state: "claimed" }
              : { reason: "bank details missing" },
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      // Someone else already claimed this payout. Return their row; do NOT
      // transfer again.
      return prisma.payout.findUnique({ where: { reference } });
    }
    throw error;
  }

  // Manual mode: recorded as owed; an admin pays by hand.
  if (!AUTO_PAYOUTS) return payout;

  // Never auto-transfer to an account whose recent change an admin has not
  // approved. The row stays as money owed until the review is cleared.
  if (holdForReview) return payout;

  // Auto mode with no bank details: the FAILED row above is the record.
  if (!recipientCode) return payout;

  const amountKobo = Math.round(amountNaira * 100);

  let result;
  try {
    result = await initiateTransfer({ recipientCode, amountKobo, reference, reason });
  } catch (error) {
    // We cannot tell whether Paystack received the request. Keep the row PENDING
    // and flag the outcome as unknown — retrying blindly could double-pay if the
    // first request actually succeeded.
    console.error(`[payout] transfer request failed for ${reference}:`, error);
    await prisma.payout.updateMany({
      where: { id: payout.id, status: "PENDING" },
      data: { gatewayResponse: { state: "unknown", message: error.message } },
    });
    return prisma.payout.findUnique({ where: { id: payout.id } });
  }

  // Paystack accepting the request is not the same as the money landing. Only
  // record a final status when Paystack reports one immediately; otherwise stay
  // PENDING and let the transfer webhook promote the row.
  let status = "PENDING";
  if (!result.ok) status = "FAILED";
  else if (result.data?.status === "success") status = "SUCCESS";
  else if (result.data?.status === "failed") status = "FAILED";

  // Guarded by status: a webhook may have already promoted this row while the
  // initiation request was in flight. Only a still-PENDING claim may change.
  await prisma.payout.updateMany({
    where: { id: payout.id, status: "PENDING" },
    data: {
      status,
      gatewayResponse: result.ok ? result.data : { message: result.message, ...result.data },
    },
  });
  return prisma.payout.findUnique({ where: { id: payout.id } });
}

// Split a delivered order's money: subtotal → restaurant, deliveryFee → rider.
// The platform keeps serviceFee (it never leaves the Paystack balance).
export async function settleOrderPayouts(orderId) {
  // Fast path and legacy guard: any existing row means the order was already
  // settled, including rows created with the old random references. Concurrent
  // callers that both pass this check are still safe — the unique deterministic
  // reference below allows exactly one insert per (order, type).
  const existing = await prisma.payout.findFirst({ where: { orderId } });
  if (existing) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: { select: { recipientCode: true, name: true } },
      delivery: {
        include: {
          rider: {
            select: {
              id: true,
              recipientCode: true,
              bankDetailsReviewRequired: true,
            },
          },
        },
      },
      payment: { select: { status: true } },
    },
  });

  if (!order) return;

  // Never pay for an order that was not completed and paid for.
  if (order.status !== "DELIVERED" || order.payment?.status !== "SUCCESS") return;

  const payouts = [
    {
      orderId,
      type: "RESTAURANT",
      amountNaira: Number(order.subtotal),
      recipientCode: order.restaurant?.recipientCode || null,
      reason: `Payout for order #${orderId} (${order.restaurant?.name || "restaurant"})`,
    },
    {
      orderId,
      type: "RIDER",
      riderId: order.delivery?.rider?.id || null,
      amountNaira: Number(order.deliveryFee),
      recipientCode: order.delivery?.rider?.recipientCode || null,
      holdForReview: Boolean(order.delivery?.rider?.bankDetailsReviewRequired),
      reason: `Delivery fee for order #${orderId}`,
    },
  ];

  await Promise.all(payouts.map((p) => createAndRunPayout(p)));
}

// Reconcile payouts whose transfer was claimed but never confirmed. This is the
// safety net for a crash between the claim and the transfer call, or a missed
// webhook: Paystack's /transfer/verify is the source of truth.
export async function verifyPendingPayouts({
  olderThanMinutes = 10,
  limit = 50,
  where = {},
  maxScan = 1000,
} = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const baseWhere = {
    ...where,
    status: "PENDING",
    recipientCode: { not: null },
    createdAt: { lt: cutoff },
  };

  // Manual-mode PENDING rows are money owed, not an in-flight transfer, and
  // they are the majority. Filter them in JS rather than by JSON path (auto
  // rows that already carry a Paystack payload have no `mode` key), paging
  // until we have enough real candidates or hit the scan cap.
  const candidates = [];
  let cursor = null;
  let scanned = 0;

  while (candidates.length < limit && scanned < maxScan) {
    const page = await prisma.payout.findMany({
      where: baseWhere,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.min(100, maxScan - scanned),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!page.length) break;

    scanned += page.length;
    for (const payout of page) {
      if (payout.gatewayResponse?.mode === "manual") continue;
      // Held payouts have no transfer at Paystack; verifying them would 404
      // them into FAILED. Skipping also keeps them visible as money owed.
      if (payout.gatewayResponse?.state === "held") continue;
      candidates.push(payout);
      if (candidates.length >= limit) break;
    }
    cursor = page[page.length - 1].id;
  }

  const summary = { scanned, checked: 0, updated: 0, stillPending: 0, notFound: 0, errors: 0 };

  for (const payout of candidates) {
    summary.checked += 1;

    let result;
    try {
      result = await verifyTransfer(payout.reference);
    } catch (error) {
      console.error(`[payout-verify] ${payout.reference}:`, error);
      summary.errors += 1;
      continue;
    }

    // Only a 404 proves the transfer never left. A 401/5xx or network error is
    // unknown, so leave the row alone for a later run.
    if (result.httpStatus === 404) {
      const update = await prisma.payout.updateMany({
        where: { id: payout.id, status: "PENDING" },
        data: {
          status: "FAILED",
          gatewayResponse: { reason: "transfer not found at Paystack", message: result.message },
        },
      });
      if (update.count) summary.notFound += 1;
      continue;
    }

    if (!result.ok || !result.data) {
      summary.errors += 1;
      continue;
    }

    const gatewayStatus = result.data?.status;
    const status =
      gatewayStatus === "success" ? "SUCCESS"
      : gatewayStatus === "failed" ? "FAILED"
      : gatewayStatus === "reversed" ? "REVERSED"
      : null;

    // Guarded by PENDING so a webhook that landed mid-run still wins.
    const update = await prisma.payout.updateMany({
      where: { id: payout.id, status: "PENDING" },
      data: status ? { status, gatewayResponse: result.data } : { gatewayResponse: result.data },
    });

    if (status) {
      summary.updated += update.count;
    } else if (update.count) {
      summary.stillPending += 1;
      if (gatewayStatus === "otp") {
        console.warn(`[payout-verify] ${payout.reference} needs OTP — automatic transfers are not enabled`);
      }
    }
  }

  return summary;
}

// Retry a FAILED payout after the recipient fixes their bank details. A retry
// is a NEW row with a new (suffixed) reference: the original stays as the audit
// trail and is linked via supersededBy so it stops counting as money owed.
export async function retryPayout(payoutId, where = {}) {
  const payout = await prisma.payout.findFirst({
    where: { id: payoutId, ...where },
    include: {
      order: {
        include: {
          restaurant: { select: { recipientCode: true } },
          delivery: { include: { rider: { select: { id: true, recipientCode: true } } } },
        },
      },
    },
  });

  if (!payout) return { ok: false, status: 404, message: "Payout not found" };
  if (payout.supersededBy) {
    return { ok: false, status: 409, message: "This payout has already been retried" };
  }
  // A held row is a claim that never called Paystack (bank details changed and
  // an admin has not approved them yet). Releasing it after approval is the
  // same operation as retrying a failed payout.
  const isHeld =
    payout.status === "PENDING" && payout.gatewayResponse?.state === "held";

  if (payout.status !== "FAILED" && !isHeld) {
    return {
      ok: false,
      status: 409,
      message: "Only FAILED or held payouts can be retried",
    };
  }

  // Manual mode never sent a transfer for the held row, so there is nothing to
  // release: the admin pays by hand and marks it paid. Only auto mode needs
  // the release path.
  if (isHeld && !AUTO_PAYOUTS) {
    return {
      ok: false,
      status: 409,
      message: "Manual payouts are on — pay this one by hand and mark it paid.",
    };
  }

  // A newer attempt may exist without supersededBy being set (the process could
  // have died between creating the retry and linking it back). Refuse rather
  // than create a third attempt while the second might still be in flight.
  const newer = await prisma.payout.findFirst({
    where: {
      orderId: payout.orderId,
      type: payout.type,
      attempt: { gt: payout.attempt },
      supersededBy: null,
    },
    select: { id: true },
  });
  if (newer) {
    return { ok: false, status: 409, message: "A newer attempt for this payout already exists" };
  }

  const recipientCode =
    payout.type === "RESTAURANT"
      ? payout.order.restaurant?.recipientCode
      : payout.order.delivery?.rider?.recipientCode;

  if (!recipientCode) {
    return { ok: false, status: 409, message: "The recipient still has no bank details on file" };
  }

  // Concurrent retries read the same max attempt; the unique reference then
  // lets exactly one insert win inside createAndRunPayout.
  const latest = await prisma.payout.findFirst({
    where: { orderId: payout.orderId, type: payout.type },
    orderBy: { attempt: "desc" },
    select: { attempt: true },
  });
  const attempt = (latest?.attempt ?? payout.attempt) + 1;

  const retry = await createAndRunPayout({
    orderId: payout.orderId,
    type: payout.type,
    // Payout.riderId survives the delivery row being deleted; fall back to the
    // order's delivery for legacy rows created before the column existed.
    riderId: payout.riderId || payout.order.delivery?.rider?.id || null,
    amountNaira: Number(payout.amount),
    recipientCode,
    reason: `Retry of payout #${payout.id} for order #${payout.orderId}`,
    attempt,
  });

  if (!retry?.id) {
    return { ok: false, status: 409, message: "Payout could not be retried (zero amount)" };
  }

  await prisma.payout.updateMany({
    where: { id: payout.id, supersededBy: null },
    data: { supersededBy: retry.id },
  });

  return { ok: true, payout: retry, attempt };
}

// Background safety net: periodically confirm PENDING transfers against
// Paystack. Disabled unless automatic payouts are on and an interval is set;
// the admin endpoint still works for manual runs either way.
export function startPayoutVerifier() {
  const minutes = Number(process.env.PAYOUT_VERIFY_INTERVAL_MINUTES || 0);
  if (process.env.AUTO_PAYOUTS !== "true") return;
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  let running = false;
  const tick = async () => {
    // Never overlap runs — a slow Paystack response must not stack up.
    if (running) return;
    running = true;
    try {
      const summary = await verifyPendingPayouts({ olderThanMinutes: 10, limit: 50 });
      if (summary.checked > 0) console.log("[payout-verify] tick", summary);
    } catch (error) {
      console.error("[payout-verify] tick failed", error);
    } finally {
      running = false;
    }
  };

  // Run once at startup to catch rows left behind by the previous process,
  // then on the interval. unref() keeps the timer from holding the process open.
  tick();
  setInterval(tick, minutes * 60 * 1000).unref();
  console.log(`[payout-verify] scheduled every ${minutes} minute(s)`);
}
