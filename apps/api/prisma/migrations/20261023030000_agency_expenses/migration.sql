-- Dépenses d'exploitation de l'agence (essence, vidange, entretien…).

CREATE TYPE "ExpenseCategory" AS ENUM (
  'FUEL',
  'OIL_CHANGE',
  'MAINTENANCE',
  'REPAIR',
  'INSURANCE',
  'CLEANING',
  'ADMINISTRATIVE',
  'OTHER'
);

CREATE TABLE "agency_expenses" (
  "id" TEXT NOT NULL,
  "agency_id" TEXT NOT NULL,
  "vehicle_id" TEXT,
  "category" "ExpenseCategory" NOT NULL,
  "amount_millimes" INTEGER NOT NULL,
  "spent_on" TIMESTAMP(3) NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agency_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agency_expenses_agency_id_spent_on_idx" ON "agency_expenses"("agency_id", "spent_on");
CREATE INDEX "agency_expenses_agency_id_category_idx" ON "agency_expenses"("agency_id", "category");

ALTER TABLE "agency_expenses"
  ADD CONSTRAINT "agency_expenses_agency_id_fkey"
  FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agency_expenses"
  ADD CONSTRAINT "agency_expenses_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agency_expenses"
  ADD CONSTRAINT "agency_expenses_amount_check"
  CHECK ("amount_millimes" > 0 AND "amount_millimes" <= 1000000000);

ALTER TABLE "agency_expenses"
  ADD CONSTRAINT "agency_expenses_note_check"
  CHECK (char_length("note") <= 300);
