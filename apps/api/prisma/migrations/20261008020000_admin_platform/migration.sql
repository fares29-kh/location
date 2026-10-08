-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "AgencyDocumentKind" AS ENUM ('TRADE_REGISTER', 'TAX_ID', 'INSURANCE', 'MANAGER_ID');

-- CreateEnum
CREATE TYPE "ReviewModerationStatus" AS ENUM ('PUBLISHED', 'FLAGGED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('OFFENSIVE', 'SPAM', 'PERSONAL_DATA', 'OFF_TOPIC');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status_reason" TEXT;

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "commission_bps" INTEGER,
ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "plan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER',
ADD COLUMN     "status_reason" TEXT,
ADD COLUMN     "tax_id" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderation_reason" TEXT,
ADD COLUMN     "moderation_status" "ReviewModerationStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "agency_documents" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "kind" "AgencyDocumentKind" NOT NULL,
    "file_key" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "subscription_millimes" INTEGER NOT NULL,
    "commission_millimes" INTEGER NOT NULL,
    "subtotal_millimes" INTEGER NOT NULL,
    "vat_rate_bps" INTEGER NOT NULL,
    "vat_millimes" INTEGER NOT NULL,
    "fiscal_stamp_millimes" INTEGER NOT NULL,
    "total_millimes" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "payment_method" "PaymentMethod",
    "reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "reporter_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_documents_agency_id_kind_key" ON "agency_documents"("agency_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_paid_at_due_at_idx" ON "invoices"("paid_at", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_agency_id_period_key" ON "invoices"("agency_id", "period");

-- CreateIndex
CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");

-- CreateIndex
CREATE INDEX "reviews_moderation_status_idx" ON "reviews"("moderation_status");

-- AddForeignKey
ALTER TABLE "agency_documents" ADD CONSTRAINT "agency_documents_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

