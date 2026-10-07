-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('ECONOMY', 'COMPACT', 'SEDAN', 'SUV', 'MINIVAN', 'LUXURY');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PICKED_UP', 'RETURNED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('RENTAL', 'REFUND', 'DEPOSIT_HELD', 'DEPOSIT_RETURNED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD_TPE', 'CHECK', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'MONEY_ORDER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" TEXT;

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "status" "AgencyStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp_phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "governorate_code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "min_driver_age" INTEGER NOT NULL DEFAULT 21,
    "min_license_years" INTEGER NOT NULL DEFAULT 2,
    "free_cancellation_hours" INTEGER NOT NULL DEFAULT 48,
    "instant_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "accepted_payment_methods" "PaymentMethod"[] DEFAULT ARRAY['CASH']::"PaymentMethod"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "plate_number" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "fuel" "FuelType" NOT NULL,
    "seats" INTEGER NOT NULL,
    "air_conditioning" BOOLEAN NOT NULL,
    "daily_rate_millimes" INTEGER NOT NULL,
    "deposit_millimes" INTEGER NOT NULL,
    "mileage_limit_km" INTEGER,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "color" TEXT NOT NULL,
    "mileage_km" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "pickup_location_id" TEXT,
    "pickup_at" TIMESTAMP(3) NOT NULL,
    "return_at" TIMESTAMP(3) NOT NULL,
    "pickup_place" JSONB NOT NULL,
    "return_place" JSONB NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "daily_rate_millimes" INTEGER NOT NULL,
    "total_millimes" INTEGER NOT NULL,
    "deposit_millimes" INTEGER NOT NULL,
    "customer_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount_millimes" INTEGER NOT NULL,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_owner_id_key" ON "agencies"("owner_id");

-- CreateIndex
CREATE INDEX "agencies_status_governorate_code_idx" ON "agencies"("status", "governorate_code");

-- CreateIndex
CREATE INDEX "vehicles_agency_id_status_idx" ON "vehicles"("agency_id", "status");

-- CreateIndex
CREATE INDEX "vehicles_category_status_idx" ON "vehicles"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_agency_id_plate_number_key" ON "vehicles"("agency_id", "plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE INDEX "bookings_agency_id_status_idx" ON "bookings"("agency_id", "status");

-- CreateIndex
CREATE INDEX "bookings_vehicle_id_pickup_at_idx" ON "bookings"("vehicle_id", "pickup_at");

-- CreateIndex
CREATE INDEX "bookings_customer_id_created_at_idx" ON "bookings"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_agency_id_created_at_idx" ON "reviews"("agency_id", "created_at");

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_governorate_code_fkey" FOREIGN KEY ("governorate_code") REFERENCES "governorates"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

