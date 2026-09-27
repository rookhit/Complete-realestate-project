-- AlterTable
ALTER TABLE "EmailVerificationCode" ADD COLUMN     "failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
