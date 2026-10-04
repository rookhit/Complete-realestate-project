-- Website forms (contact, callback, property enquiry) are signed-in only: each message records the
-- account that sent it. SetNull keeps the message if the account is deleted. 2026-10-02.
ALTER TABLE "Message" ADD COLUMN "userId" TEXT;
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_userId_idx" ON "Message"("userId");
