import type { Db } from '@web-starter/db';

/**
 * Structural session shape (mirrors Better Auth's session without importing
 * it — the auth instance lives in apps/api, this package stays framework-thin).
 */
export type SessionUser = {
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
};

export type AuthSession = {
  session: {
    expiresAt: Date;
    id: string;
    userId: string;
  };
  user: SessionUser;
};

/** Plan metadata exposed on the public pricing surface (mirrors apps/api plans). */
export type PlanInfo = {
  interval: 'month';
  name: string;
  priceId: string;
  unitAmount: number;
};

/**
 * Request context available to every oRPC procedure.
 * Built once per request by the server (apps/api).
 */
export type Context = {
  db: Db;
  plans: Array<PlanInfo>;
  session: AuthSession | null;
};
