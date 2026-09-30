-- AlterTable
ALTER TABLE "ListingSubmission" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "PropertyComment" ADD COLUMN     "authorAvatarUrl" TEXT;

-- CreateIndex
CREATE INDEX "ListingSubmission_userId_idx" ON "ListingSubmission"("userId");

-- AddForeignKey
ALTER TABLE "ListingSubmission" ADD CONSTRAINT "ListingSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

