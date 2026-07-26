// BEFORE — representative of "business logic inside route handlers"
// (this is a sample I wrote to demonstrate the pattern, not a real client's code)

const express = require('express');
const router = express.Router();
const db = require('../db'); // raw connection, used directly in the handler

router.post('/api/orders/:id/apply-discount', async (req, res) => {
  const order = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);

  if (!order) {
    return res.status(404).send('not found');
  }

  // Business rule #1: discount code validity — inline, untested, unreusable
  let discountPercent = 0;
  if (req.body.code === 'SAVE10') {
    discountPercent = 10;
  } else if (req.body.code === 'SAVE20') {
    if (order.total > 100) {
      discountPercent = 20;
    } else {
      discountPercent = 10;
    }
  } else if (req.body.code === 'VIP') {
    // Business rule #2: VIP customers get 25%, but only if they've ordered
    // 3+ times before AND the order isn't already discounted
    const pastOrders = await db.query(
      'SELECT COUNT(*) as c FROM orders WHERE customer_id = ? AND status = "completed"',
      [order.customer_id]
    );
    if (pastOrders[0].c >= 3 && order.discount_percent === 0) {
      discountPercent = 25;
    }
  }

  // Business rule #3: discount can never take the order below $5, and orders
  // over $500 are capped at 15% regardless of code — a fraud-prevention rule
  // someone added directly in this handler after an incident
  let newTotal = order.total * (1 - discountPercent / 100);
  if (order.total > 500 && discountPercent > 15) {
    discountPercent = 15;
    newTotal = order.total * 0.85;
  }
  if (newTotal < 5) {
    newTotal = 5;
  }

  await db.query('UPDATE orders SET total = ?, discount_percent = ? WHERE id = ?', [
    newTotal,
    discountPercent,
    order.id,
  ]);

  res.json({ total: newTotal, discountPercent });
});

module.exports = router;

/*
 * What's wrong here, concretely:
 * 1. Three distinct business rules (code validity, VIP eligibility, fraud cap)
 *    are interleaved in one function. You cannot unit test "what does VIP
 *    eligibility mean" without spinning up Express and a DB.
 * 2. The fraud cap silently overrides whatever discount was computed above it,
 *    several lines away from the code that set it — easy to miss when editing.
 * 3. No validation on req.body.code, no handling for an unrecognized code
 *    other than silently applying 0% (which looks like success to the caller).
 * 4. Rules are undocumented anywhere except this code — someone has to read
 *    imperative branching to reverse-engineer "what are our discount rules."
 */
