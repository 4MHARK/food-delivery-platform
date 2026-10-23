import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import riderMiddleware from "../middleware/rider.middleware.js";
import { validate } from "../middleware/validate.js";
import { deliveryStatusSchema } from "../validation/schemas.js";
import { notify } from "../services/events.js";
import { settleOrderPayouts } from "../services/payouts.js";
import { recordDeliveryFailure } from "../services/accountability.js";
import { ACTIVE_DELIVERY_STATUSES, notifyCampusRiders } from "../services/deliveryQueue.js";
import { generateDeliveryCode } from "../utils/deliveryCode.js";
import {
  buildProximityAudit,
  decideProximityAction,
  evaluateDropoffLocation,
  getProximityConfig,
} from "../utils/geo.js";

const router = express.Router();

// Remove the handoff code from rider-facing payloads so only the customer sees it.
const hideDeliveryCode = (order) => { if (order) delete order.deliveryCode; return order; };

// State machine: valid transitions
const VALID_TRANSITIONS = {
  ZILLA_ON_IT: ["AT_KITCHEN", "FAILED"],
  AT_KITCHEN:  ["BAGGED", "FAILED"],
  BAGGED:      ["MOVING", "FAILED"],
  MOVING:      ["CLOSE_BY", "FAILED"],
  CLOSE_BY:    ["DELIVERED", "FAILED"],
  DELIVERED:   [],
  FAILED:      [],
};

// Brute-force protection, scoped to the rider assignment:
// - 5 wrong guesses on a delivery → release it to the queue immediately.
// - 15 wrong guesses on an order → require manual verification.
// The order total stops a rider cycling deliveries to reset the counter.
const MAX_CODE_ATTEMPTS_PER_DELIVERY = 5;
const MAX_CODE_ATTEMPTS_PER_ORDER = 15;

// Get available orders for riders (READY_FOR_PICKUP, no delivery assigned, not rejected by this rider)
router.get("/riders/available-orders", authMiddleware, riderMiddleware, async (req, res, next) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider profile not found. Please register first." });
    }

    // Enforcement belongs here, not only in the accept endpoint and the UI:
    // a suspended or unverified rider should never receive the order queue.
    if (!rider.isVerified || rider.isSuspended || !rider.isAvailable) {
      const reason = rider.isSuspended
        ? "Your rider account is suspended. Contact your campus admin."
        : !rider.isVerified
          ? "Your rider profile is pending verification."
          : "You are offline — go online to see orders.";

      return res.status(200).json({
        message: reason,
        orders: [],
        eligibility: {
          isVerified: rider.isVerified,
          isSuspended: rider.isSuspended,
          isAvailable: rider.isAvailable,
        },
      });
    }

    const orders = await prisma.order.findMany({
      where: {
        status: "READY_FOR_PICKUP",
        // A rider must never be able to pick up their own order.
        customerId: { not: rider.userId },
        // A failed delivery keeps its row for the rider's history, but the
        // order itself is back in the queue. Filtering on `delivery: null`
        // alone hid those orders from every rider forever.
        OR: [{ delivery: null }, { delivery: { status: "FAILED" } }],
        // Only this rider's campus — never expose other campuses' orders.
        restaurant: { campusId: rider.campusId },
        rejectedBy: { none: { riderId: rider.id } }, // Exclude orders this rider skipped
      },
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
        restaurant: {
          select: { id: true, name: true, address: true, phone: true, lat: true, lng: true },
        },
        // Phone is revealed by the accept response, after assignment.
        customer: {
          select: { id: true, name: true },
        },
        deliveryLandmark: { select: { id: true, name: true, category: true } },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    res.status(200).json({
      message: "Available orders fetched successfully",
      orders: orders.map(hideDeliveryCode),
    });
  } catch (error) {
  next(error)
  }
});

// Reject an available order (rider skips it — hidden only from them)
router.post("/riders/reject-order/:orderId", authMiddleware, riderMiddleware, async (req, res, next) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider profile not found." });
    }

    const orderId = Number(req.params.orderId);

    // Verify the order exists and is still available
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { campusId: true } } },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.restaurant.campusId !== rider.campusId) {
      return res.status(403).json({ message: "This order is outside your campus." });
    }

    if (order.status !== "READY_FOR_PICKUP") {
      return res.status(400).json({ message: "This order is no longer available" });
    }

    // Create the rejection (upsert — idempotent, no duplicate error)
    await prisma.rejectedOrder.upsert({
      where: {
        riderId_orderId: { riderId: rider.id, orderId },
      },
      create: { riderId: rider.id, orderId },
      update: {}, // no-op if already rejected
    });

    res.status(200).json({
      message: "Order skipped — it will no longer appear in your available list.",
    });
  } catch (error) {
  next(error)
  }
});

// Accept an order (assign rider, create delivery, move order to OUT_FOR_DELIVERY)
router.post("/deliveries/:orderId/accept", authMiddleware, riderMiddleware, async (req, res, next) => {
  try {
    // Look up the rider
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    if (!rider.isAvailable) {
      return res.status(400).json({
        message: "You are currently unavailable. Set yourself available to accept orders.",
      });
    }

    if (!rider.isVerified) {
      return res.status(403).json({
        message: "Your rider profile is pending verification. You cannot accept orders yet.",
      });
    }

    if (rider.isSuspended) {
      return res.status(403).json({
        message: "Your rider account has been suspended. Contact your campus admin.",
      });
    }

    const orderId = Number(req.params.orderId);

    // Use a transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Guard: rider must not already have an active delivery
      const activeDelivery = await tx.delivery.findFirst({
        where: {
          riderId: rider.id,
          status: { in: ACTIVE_DELIVERY_STATUSES },
        },
      });

      if (activeDelivery) {
        throw {
          status: 409,
          message: "You already have an active delivery. Complete or fail it before accepting a new order.",
        };
      }

      // Verify order exists and is in READY_FOR_PICKUP status
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          delivery: true,
          restaurant: { select: { campusId: true } },
        },
      });

      if (!order) {
        throw { status: 404, message: "Order not found" };
      }

      // Self-accept check: the UI filter is not enough, the API must refuse it
      // too. Otherwise a rider could claim their own order and pay themselves.
      if (order.customerId === rider.userId) {
        throw { status: 403, message: "You cannot accept your own order." };
      }

      if (order.restaurant.campusId !== rider.campusId) {
        throw { status: 403, message: "This order is outside your campus." };
      }

      if (order.status !== "READY_FOR_PICKUP") {
        throw { status: 400, message: "This order is no longer available for pickup" };
      }

      // The available-orders list filters skipped/burned orders from the UI;
      // this is the API equivalent, so a barred rider cannot accept by ID.
      const barred = await tx.rejectedOrder.findUnique({
        where: { riderId_orderId: { riderId: rider.id, orderId } },
      });

      if (barred) {
        throw { status: 403, message: "This order is not available to you." };
      }

      if (order.delivery) {
        // If the previous delivery failed, clean it up so a new rider can accept.
        // deleteMany, not delete: a concurrent re-accept may have removed the
        // row already, and a missing row must not abort our transaction.
        if (order.delivery.status === "FAILED") {
          await tx.delivery.deleteMany({
            where: { id: order.delivery.id, status: "FAILED" },
          });
        } else {
          throw { status: 409, message: "This order has already been assigned to a rider" };
        }
      }

      // Create delivery and update order status atomically
      const delivery = await tx.delivery.create({
        data: {
          orderId,
          riderId: rider.id,
          status: "ZILLA_ON_IT",
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: "OUT_FOR_DELIVERY" },
        include: {
          orderItems: { include: { menuItem: true } },
          restaurant: { select: { id: true, name: true, address: true, phone: true, ownerId: true, lat: true, lng: true } },
          customer: { select: { id: true, name: true, phone: true } },
          deliveryLandmark: { select: { id: true, name: true, category: true } },
        },
      });

      return { delivery, order: updatedOrder };
    }, { timeout: 20000, maxWait: 10000 });

    // Notify the customer (rider on the way) and the restaurant (rider assigned).
    notify("order:updated", [result.order.customerId, result.order.restaurant.ownerId], {
      status: "OUT_FOR_DELIVERY",
      customerId: result.order.customerId,
      ownerId: result.order.restaurant.ownerId,
      orderId: result.order.id,
    });

    res.status(201).json({
      message: "Order accepted successfully",
      delivery: result.delivery,
      order: hideDeliveryCode(result.order),
    });
  } catch (error) {
    // P2002 means a unique index won a race that the in-transaction findFirst
    // guard cannot see: either this rider already has an active delivery
    // (partial unique index) or another rider took the order (orderId unique).
    if (error.code === "P2002") {
      // The index name may show up in meta.target or only in the raw message.
      const violated = `${error.meta?.target || ""} ${error.message || ""}`;
      return res.status(409).json({
        message: violated.includes("one_active_per_rider")
          ? "You already have an active delivery. Complete or fail it before accepting a new order."
          : "This order was just taken by another rider.",
      });
    }

    // Handle structured throws from the transaction
    if (error.status) {

     return next(error)
    }
   next(error)
  }
});

// Update delivery status
router.put("/deliveries/:id/status", authMiddleware, riderMiddleware, validate(deliveryStatusSchema), async (req, res, next) => {
  try {
    const {
      status,
      reason,
      lat,
      lng,
      accuracy,
      capturedAt,
      locationUnverifiedReason,
    } = req.body;

    const deliveryId = Number(req.params.id);
    const userId = req.user.id;

    // ── Transaction: fetch, validate, and update atomically ──
    const result = await prisma.$transaction(async (tx) => {
      // Fetch the delivery (inside TX — prevents race conditions)
      const delivery = await tx.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          rider: true,
          order: {
            include: {
              deliveryLandmark: { select: { lat: true, lng: true } },
            },
          },
        },
      });

      if (!delivery) {
        throw { status: 404, message: "Delivery not found" };
      }

      // Verify this rider owns the delivery
      if (delivery.rider.userId !== userId) {
        throw { status: 403, message: "You can only update your own deliveries" };
      }

      // Validate the transition (inside TX — atomic with the update below)
      const allowed = VALID_TRANSITIONS[delivery.status] || [];
      if (!allowed.includes(status)) {
        throw {
          status: 400,
          message: `Cannot transition from ${delivery.status} to ${status}. Allowed: ${allowed.join(", ") || "none"}`,
        };
      }

      // Once the food is in the rider's hands, "FAILED" must carry a written
      // reason. Without it the audit trail says nothing, and the reason is what
      // an admin reviews before deciding on suspension.
      if (
        status === "FAILED" &&
        ["BAGGED", "MOVING", "CLOSE_BY"].includes(delivery.status) &&
        String(reason || "").trim().length < 5
      ) {
        throw {
          status: 400,
          message:
            "A reason of at least 5 characters is required after the food has been picked up.",
        };
      }

      // Proximity gate for the handoff states. A clear "too far" reading is a
      // hard stop; missing/unreliable GPS may proceed with a reason and flag.
      let locationResult = null;
      if (status === "CLOSE_BY" || status === "DELIVERED") {
        const config = getProximityConfig();

        if (config.mode !== "off") {
          const dropoff =
            delivery.order.deliveryLat != null &&
            delivery.order.deliveryLng != null
              ? {
                  lat: delivery.order.deliveryLat,
                  lng: delivery.order.deliveryLng,
                }
              : delivery.order.deliveryLandmark?.lat != null &&
                  delivery.order.deliveryLandmark?.lng != null
                ? {
                    lat: delivery.order.deliveryLandmark.lat,
                    lng: delivery.order.deliveryLandmark.lng,
                  }
                : null;

          const evaluation = evaluateDropoffLocation({
            dropoff,
            input: { lat, lng, accuracy, capturedAt },
            config,
          });

          const decision = decideProximityAction({
            evaluation,
            reason: locationUnverifiedReason,
            mode: config.mode,
          });

          if (decision.action === "skip") {
            locationResult = null;
          } else if (decision.action === "reject") {
            // GPS says the rider is clearly somewhere else — do not allow it.
            return { locationError: evaluation };
          } else if (decision.action === "needReason") {
            return { locationError: { ...evaluation, requiresReason: true } };
          } else if (decision.action === "warn") {
            locationResult = evaluation;
            console.warn("[delivery] proximity warning", {
              deliveryId,
              ...evaluation,
            });
          } else {
            // allow / allowWithReason
            locationResult = evaluation;
          }
        }
      }

      // Set timestamps based on new status
      const data = { status };
      if (status === "BAGGED") {
        data.pickedUpAt = new Date();
      }
      if (status === "DELIVERED") {
        data.deliveredAt = new Date();
        data.codeAttempts = 0; // successful handoff resets this assignment
      }
      if (status === "FAILED" && reason) {
        data.failureReason = reason;
      }

      // Persist the proximity evidence for this handoff state. CLOSE_BY and
      // DELIVERED have separate columns so neither overwrites the other.
      if (locationResult && (status === "CLOSE_BY" || status === "DELIVERED")) {
        Object.assign(
          data,
          buildProximityAudit({
            status,
            evaluation: locationResult,
            input: { lat, lng, accuracy, capturedAt },
            reason: locationUnverifiedReason,
          })
        );
      }

      // Verify the handoff code BEFORE updating the delivery. Wrong codes
      // return instead of throwing, because a thrown error would roll back the
      // attempt counters with the rest of the transaction.
      if (status === "DELIVERED") {
        // A paid order always has a code; if it is missing, the rider cannot
        // complete the delivery and should not be charged an attempt for it.
        if (!delivery.order.deliveryCode) {
          return { codeMissing: true };
        }

        const orderAttempts = delivery.order.deliveryCodeAttempts || 0;
        if (orderAttempts >= MAX_CODE_ATTEMPTS_PER_ORDER) {
          return { codeBlocked: true };
        }

        const code = String(req.body.code || "").trim();

        if (code !== delivery.order.deliveryCode) {
          const attempts = (delivery.codeAttempts || 0) + 1;
          const totalAttempts = orderAttempts + 1;

          // Fifth miss on this assignment: release the order now. The customer
          // should not wait out a lock, and the next rider gets a fresh five
          // attempts because codeAttempts lives on the Delivery.
          if (attempts >= MAX_CODE_ATTEMPTS_PER_DELIVERY) {
            const failedDelivery = await tx.delivery.update({
              where: { id: deliveryId },
              data: {
                status: "FAILED",
                failureReason: "Too many incorrect delivery-code attempts",
                codeAttempts: attempts,
              },
              include: {
                order: {
                  include: {
                    restaurant: { select: { ownerId: true, campusId: true } },
                    customer: { select: { id: true } },
                  },
                },
              },
            });

            const requeuedOrder = await tx.order.update({
              where: { id: delivery.orderId },
              data: {
                status: "READY_FOR_PICKUP",
                deliveryCodeAttempts: totalAttempts,
                // Unconditional rotation: assume this rider saw or guessed the
                // code. Committed with the failure, never in a separate write.
                deliveryCode: generateDeliveryCode(),
              },
            });

            // Same transaction as the failure: audit row + rider counters.
            await recordDeliveryFailure(tx, {
              orderId: delivery.orderId,
              riderId: delivery.riderId,
              kind: "CODE_ATTEMPTS",
              reason: "Too many incorrect delivery-code attempts",
              codeAttempts: attempts,
            });

            // Bar this rider from re-accepting. Without it they could
            // immediately re-accept and burn the freshly rotated code, turning
            // the attempt cap into a DoS on the customer.
            // createMany + skipDuplicates is idempotent in one statement, so a
            // concurrent double-submit cannot trip the unique constraint.
            await tx.rejectedOrder.createMany({
              data: [{ riderId: delivery.riderId, orderId: delivery.orderId }],
              skipDuplicates: true,
            });

            return {
              codeReleased: true,
              delivery: failedDelivery,
              order: requeuedOrder,
              attempts,
              riderUserId: delivery.rider.userId,
            };
          }

          await tx.delivery.update({
            where: { id: deliveryId },
            data: { codeAttempts: attempts },
          });
          await tx.order.update({
            where: { id: delivery.orderId },
            data: { deliveryCodeAttempts: totalAttempts },
          });

          return {
            codeError: true,
            attempts,
            remaining: MAX_CODE_ATTEMPTS_PER_DELIVERY - attempts,
          };
        }
      }

      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data,
        include: {
          order: {
            include: {
              orderItems: { include: { menuItem: true } },
              restaurant: { select: { id: true, name: true, address: true, ownerId: true, campusId: true, lat: true, lng: true } },
              customer: { select: { id: true, name: true, phone: true } },
              deliveryLandmark: { select: { id: true, name: true, category: true } },
            },
          },
          rider: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });

      let updatedOrder = null;

      // When delivery is marked FAILED: keep the record for audit trail
      // and reset the order to READY_FOR_PICKUP so another rider can accept it
      if (status === "FAILED") {
        updatedOrder = await tx.order.update({
          where: { id: delivery.orderId },
          data: {
            status: "READY_FOR_PICKUP",
            // Unconditional rotation: a failed handoff voids the old code.
            deliveryCode: generateDeliveryCode(),
          },
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: { select: { id: true, name: true, address: true } },
            customer: { select: { id: true, name: true, phone: true } },
            deliveryLandmark: { select: { id: true, name: true, category: true } },
          },
        });

        // Audit + accountability, commit-or-rollback with the failure.
        await recordDeliveryFailure(tx, {
          orderId: delivery.orderId,
          riderId: delivery.riderId,
          kind: "REPORTED",
          reason: reason || null,
          codeAttempts: delivery.codeAttempts || 0,
        });

        // The order is someone else's now; don't let the same rider take it
        // back immediately.
        await tx.rejectedOrder.createMany({
          data: [{ riderId: delivery.riderId, orderId: delivery.orderId }],
          skipDuplicates: true,
        });
      }

      // When delivery is marked DELIVERED, also update the order and clear
      // the attempt counter for this order.
      if (status === "DELIVERED") {
        updatedOrder = await tx.order.update({
          where: { id: delivery.orderId },
          data: {
            status: "DELIVERED",
            deliveryCodeAttempts: 0,
          },
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: { select: { id: true, name: true, address: true } },
            customer: { select: { id: true, name: true, phone: true } },
            deliveryLandmark: { select: { id: true, name: true, category: true } },
          },
        });
      }

      return {
        delivery: updatedDelivery,
        order: updatedOrder,
        riderUserId: delivery.rider.userId,
      };
    }, { timeout: 20000, maxWait: 10000 });

    if (result.locationError) {
      return res.status(422).json({
        message: result.locationError.message,
        code: result.locationError.code,
        requiresReason: !!result.locationError.requiresReason,
        distanceMeters: result.locationError.distanceMeters ?? null,
        radiusMeters: result.locationError.radiusMeters ?? null,
        accuracyMeters: result.locationError.accuracyMeters ?? null,
      });
    }

    if (result.codeMissing) {
      return res.status(409).json({
        message:
          "This order has no delivery code. Ask the customer to check their order, or contact support.",
      });
    }

    if (result.codeBlocked) {
      return res.status(429).json({
        message:
          "This order has had too many incorrect code attempts. Contact support to verify it manually.",
      });
    }

    if (result.codeReleased) {
      // The delivery is FAILED and the order is back in the queue. Reuse the
      // normal FAILED notifications so the customer knows a new rider is coming.
      const order = result.delivery.order;
      const customerId = order?.customer?.id;
      const ownerId = order?.restaurant?.ownerId;
      notify("order:updated", [customerId, ownerId].filter(Boolean), {
        status: "FAILED",
        customerId,
        ownerId,
        orderId: order?.id,
      });

      // Wake the other riders on this campus immediately.
      await notifyCampusRiders(order, {
        excludeUserId: result.riderUserId,
      });

      return res.status(429).json({
        message:
          "Too many incorrect codes. This delivery has been released to another rider.",
      });
    }

    if (result.codeError) {
      return res.status(400).json({
        message: `Incorrect delivery code. ${result.remaining} attempt${
          result.remaining === 1 ? "" : "s"
        } left.`,
      });
    }

    // Fire the payout transfers after the transaction commits — non-blocking so a
    // payout failure never makes the rider's "Delivered" appear to fail.
    if (status === "DELIVERED") {
      settleOrderPayouts(result.delivery.orderId).catch((e) => console.error("[payout]", e));
    }

    const response = {
      message: "Delivery status updated successfully",
      delivery: result.delivery,
    };

    hideDeliveryCode(result.delivery.order);

    if (result.order) {
      response.order = hideDeliveryCode(result.order);
    }

    // Notify the customer and restaurant of delivery progress. Micro-transitions
    // (AT_KITCHEN, MOVING, CLOSE_BY) still refresh the live tracker via SSE but
    // intentionally don't push — only the milestones below have a push message.
    const order = result.delivery.order;
    const customerId = order?.customer?.id;
    const ownerId = order?.restaurant?.ownerId;
    if (customerId || ownerId) {
      notify(
        "order:updated",
        [customerId, ownerId].filter(Boolean),
        { status, customerId, ownerId, orderId: order?.id }
      );
    }

    // A manually reported failure also returns the order to the queue; ping
    // the other campus riders so it gets picked up immediately.
    if (status === "FAILED") {
      await notifyCampusRiders(order, {
        excludeUserId: result.riderUserId,
      });
    }

    res.status(200).json(response);
  } catch (error) {
    // Handle structured throws from the transaction
    if (error.status) {
      return next(error)
    }
   next(error)
  }
});

// Get rider's own deliveries
router.get("/riders/my-deliveries", authMiddleware, riderMiddleware, async (req, res, next) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    const deliveries = await prisma.delivery.findMany({
      where: { riderId: rider.id },
      include: {
        order: {
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: { select: { id: true, name: true, address: true, phone: true, lat: true, lng: true } },
            customer: { select: { id: true, name: true, phone: true } },
            deliveryLandmark: { select: { id: true, name: true, category: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    deliveries.forEach((d) => hideDeliveryCode(d.order));
    res.status(200).json({
      message: "Deliveries fetched successfully",
      deliveries,
    });
  } catch (error) {
   next(error)
  }
});

// Get rider stats (earnings, completed deliveries)
router.get("/riders/stats", authMiddleware, riderMiddleware, async (req, res, next) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider profile not found." });
    }

    const completed = await prisma.delivery.findMany({
      where: { riderId: rider.id, status: "DELIVERED" },
      select: { deliveredAt: true },
    });

    const totalDeliveries = completed.length;

    // This week's stats
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const thisWeekDeliveries = completed.filter(
      (d) => d.deliveredAt && new Date(d.deliveredAt) >= weekStart
    ).length;

    // Earnings follow the payout ledger, not the order total: money that
    // failed or was reversed must never look like income. PENDING is included
    // because it is owed/in flight (manual-mode payouts stay PENDING).
    const payouts = await prisma.payout.findMany({
      where: {
        type: "RIDER",
        order: { delivery: { riderId: rider.id } },
        supersededBy: null,
      },
      select: { amount: true, status: true, createdAt: true },
    });

    const sum = (rows) =>
      rows.reduce((total, p) => total + Number(p.amount), 0);

    const paid = payouts.filter((p) => p.status === "SUCCESS");
    const pending = payouts.filter((p) => p.status === "PENDING");
    const earned = [...paid, ...pending];

    const thisWeek = (rows) =>
      rows.filter((p) => new Date(p.createdAt) >= weekStart);

    const totalEarnings = sum(earned);
    const thisWeekEarnings = sum(thisWeek(earned));

    res.status(200).json({
      message: "Rider stats fetched successfully",
      stats: {
        totalDeliveries,
        totalEarnings,
        thisWeekDeliveries,
        thisWeekEarnings,
        // Split the total so "earned" is never mistaken for "already paid".
        paidEarnings: sum(paid),
        pendingEarnings: sum(pending),
        thisWeekPaid: sum(thisWeek(paid)),
        thisWeekPending: sum(thisWeek(pending)),
      },
    });
  } catch (error) {
   next(error)
  }
});

export default router;
