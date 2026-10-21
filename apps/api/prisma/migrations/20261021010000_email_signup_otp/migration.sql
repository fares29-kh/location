-- AlterEnum
ALTER TYPE "OtpChannel" ADD VALUE IF NOT EXISTS 'EMAIL';

-- AlterTable
ALTER TABLE "otp_codes" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE INDEX "otp_codes_email_purpose_created_at_idx" ON "otp_codes"("email", "purpose", "created_at");
