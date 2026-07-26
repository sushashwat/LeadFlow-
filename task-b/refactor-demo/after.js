// AFTER — business logic extracted into a pure, testable service.
// The route handler's only job is: parse request, call service, return response.

// ---- services/discounts.js ----
// Pure functions: no DB, no HTTP, no side effects. Every rule is named,
// isolated, and independently testable.

const DISCOUNT_CODES = {
  SAVE10: () => 10,
  SAVE20: (order) => (order.total > 100 ? 20 : 10),
  VIP: (order, context) => {
    const isEligible =
      context.completedOrderCount >= 3 && order.discountPercent === 0;
    return isEligible ? 25 : 0;
  },
};

const FRAUD_CAP_THRESHOLD = 500;
const FRAUD_CAP_PERCENT = 15;
const MINIMUM_ORDER_TOTAL = 5;

function resolveDiscountPercent(code, order, context) {
  const rule = DISCOUNT_CODES[code];
  if (!rule) return { discountPercent: 0, recognized: false };
  return { discountPercent: rule(order, context), recognized: true };
}

function applyFraudCap(order, discountPercent) {
  if (order.total > FRAUD_CAP_THRESHOLD && discountPercent > FRAUD_CAP_PERCENT) {
    return FRAUD_CAP_PERCENT;
  }
  return discountPercent;
}

function computeDiscountedTotal(order, discountPercent) {
  const raw = order.total * (1 - discountPercent / 100);
  return Math.max(raw, MINIMUM_ORDER_TOTAL);
}

/**
 * Given an order, a discount code, and customer context, returns the
 * resulting discount percent and total. Pure function - no I/O.
 */
function applyDiscount(order, code, context) {
  const { discountPercent: proposed, recognized } = resolveDiscountPercent(
    code,
    order,
    context
  );
  if (!recognized) {
    return { ok: false, reason: 'unrecognized_code' };
  }
  const cappedPercent = applyFraudCap(order, proposed);
  const total = computeDiscountedTotal(order, cappedPercent);
  return { ok: true, discountPercent: cappedPercent, total };
}

module.exports = { applyDiscount };

// ---- routes/orders.js ----
// The route handler is now a thin adapter: fetch what the service needs,
// call it, persist the result, respond. No business rule lives here.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { applyDiscount } = require('../services/discounts');

router.post('/api/orders/:id/apply-discount', async (req, res) => {
  const order = await db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const completedOrderCount = await db.countCompletedOrders(order.customerId);
  const result = applyDiscount(order, req.body.code, { completedOrderCount });

  if (!result.ok) {
    return res.status(400).json({ error: 'Discount code not recognized' });
  }

  await db.updateOrderTotal(order.id, result.total, result.discountPercent);
  res.json({ total: result.total, discountPercent: result.discountPercent });
});

module.exports = router;

/*
 * What improved, concretely:
 * 1. Every rule is a named, isolated function. "What does VIP eligibility
 *    mean" is answered by reading one 4-line function, not tracing branches.
 * 2. applyDiscount() is pure - it can be unit tested with plain objects,
 *    no Express, no DB, no mocking framework:
 *
 *      test('VIP caps at 15% for orders over $500', () => {
 *        const order = { total: 600, discountPercent: 0 };
 *        const result = applyDiscount(order, 'VIP', { completedOrderCount: 5 });
 *        expect(result.discountPercent).toBe(15);
 *      });
 *
 * 3. An unrecognized code now returns an explicit 400 with a reason, instead
 *    of silently applying 0% and looking like success.
 * 4. The fraud cap is a named function (applyFraudCap) directly next to the
 *    rule it modifies, not several lines below the code path it silently
 *    overrides.
 * 5. The route handler shrank from ~35 lines of interleaved logic to a
 *    5-line adapter - the part that's actually specific to HTTP.
 */
