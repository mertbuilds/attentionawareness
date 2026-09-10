-- Better Auth 1.7 requires account.issuer (unique with accountId)
ALTER TABLE "account" ADD COLUMN "issuer" TEXT NOT NULL;

CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
