import type { Db } from '@keepyourattention/db';
import type Stripe from 'stripe';

/**
 * Idempotency guard for Stripe webhook events. Records the event id; returns
 * false when the event was already processed so custom handling can skip.
 *
 * Note: the Better Auth Stripe plugin runs its built-in subscription sync
 * BEFORE onEvent and offers no pre-hook, so this guard protects only our own
 * processing. The built-in handlers are idempotent upserts by design.
 */
export async function recordStripeEvent(db: Db, event: Stripe.Event): Promise<boolean> {
  const existing = await db.stripeEvent.findUnique({ where: { id: event.id } });
  if (existing) {
    return false;
  }
  await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  return true;
}
