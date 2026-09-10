import type { ServerEnv } from '@keepyourattention/env/server';

/**
 * Fixed price id seeded into the emulate.dev Stripe emulator
 * (see emulate.config.yaml). Real environments set STRIPE_PRICE_PRO_MONTHLY.
 */
const LOCAL_PRICE_PRO_MONTHLY = 'price_pro_monthly_local';

export type PlanInfo = {
  interval: 'month';
  name: string;
  priceId: string;
  unitAmount: number;
};

/**
 * Subscription plans. Single source of truth for both the Better Auth
 * Stripe plugin (checkout) and the public `billing.plans` procedure
 * (pricing page metadata). Grow per product.
 */
export function getPlans(env: ServerEnv): Array<PlanInfo> {
  return [
    {
      interval: 'month',
      name: 'pro',
      priceId: env.STRIPE_PRICE_PRO_MONTHLY ?? LOCAL_PRICE_PRO_MONTHLY,
      unitAmount: 2000,
    },
  ];
}
