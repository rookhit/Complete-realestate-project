-- Sessions: when the sign-in that started a chain of refresh tokens happened, so a session can be
-- given an absolute limit (admins: 3 days). Existing tokens count from when they were issued.
ALTER TABLE "RefreshToken" ADD COLUMN "sessionStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "RefreshToken" SET "sessionStartedAt" = "createdAt";

-- Messages: when the admin first opened it; opened messages are deleted 90 days later. Messages
-- already read count from now, so nothing is deleted the day this is deployed.
ALTER TABLE "Message" ADD COLUMN "readAt" TIMESTAMP(3);
UPDATE "Message" SET "readAt" = CURRENT_TIMESTAMP WHERE "read" = true;
CREATE INDEX "Message_readAt_idx" ON "Message"("readAt");
