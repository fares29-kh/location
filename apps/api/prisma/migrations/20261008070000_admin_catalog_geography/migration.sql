-- Référentiels gérés par l'administration : catégories et marques de véhicules, délégations et
-- municipalités. La catégorie d'un véhicule devient une clé étrangère (l'enum disparaît) ; les
-- véhicules existants sont rattachés aux six catégories d'origine.

SET lock_timeout = '10s';

-- Catégories -------------------------------------------------------------------------------

CREATE TABLE "vehicle_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_fr" TEXT NOT NULL DEFAULT '',
    "description_ar" TEXT NOT NULL DEFAULT '',
    "description_en" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_categories_slug_key" ON "vehicle_categories"("slug");

INSERT INTO "vehicle_categories"
  ("id", "slug", "name_fr", "name_ar", "name_en", "description_fr", "description_ar", "description_en", "position", "updated_at")
VALUES
  ('vcat_city', 'city', 'Citadine', 'سيارة مدينة', 'City car',
   'Économique et facile à garer, idéale en ville.',
   'اقتصادية وسهلة الركن، مثالية داخل المدينة.',
   'Economical and easy to park, ideal in town.', 0, CURRENT_TIMESTAMP),
  ('vcat_compact', 'compact', 'Compacte', 'مدمجة', 'Compact',
   'Polyvalente et confortable, en ville comme sur la route.',
   'متعددة الاستعمالات ومريحة، في المدينة وعلى الطريق.',
   'Versatile and comfortable, in town and on the road.', 1, CURRENT_TIMESTAMP),
  ('vcat_sedan', 'sedan', 'Berline', 'سيدان', 'Sedan',
   'Grand coffre et confort pour les longs trajets.',
   'صندوق واسع وراحة للرحلات الطويلة.',
   'Large boot and comfort for long journeys.', 2, CURRENT_TIMESTAMP),
  ('vcat_suv', 'suv', 'SUV', 'دفع رباعي', 'SUV',
   'Position de conduite haute, à l’aise sur toutes les routes.',
   'وضعية قيادة مرتفعة، مريحة على كل الطرقات.',
   'High driving position, at ease on every road.', 3, CURRENT_TIMESTAMP),
  ('vcat_family', 'family', 'Familiale', 'عائلية', 'Family',
   'Jusqu’à 7 places pour voyager en famille ou entre amis.',
   'حتى 7 مقاعد للسفر مع العائلة أو الأصدقاء.',
   'Up to 7 seats for trips with family or friends.', 4, CURRENT_TIMESTAMP),
  ('vcat_premium', 'premium', 'Premium', 'فاخرة', 'Premium',
   'Confort haut de gamme pour vos déplacements d’affaires.',
   'راحة راقية لتنقلاتك المهنية.',
   'Top-of-the-range comfort for business travel.', 5, CURRENT_TIMESTAMP);

ALTER TABLE "vehicles" ADD COLUMN "category_id" TEXT;

UPDATE "vehicles" SET "category_id" = CASE "category"
  WHEN 'ECONOMY' THEN 'vcat_city'
  WHEN 'COMPACT' THEN 'vcat_compact'
  WHEN 'SEDAN' THEN 'vcat_sedan'
  WHEN 'SUV' THEN 'vcat_suv'
  WHEN 'MINIVAN' THEN 'vcat_family'
  WHEN 'LUXURY' THEN 'vcat_premium'
END;

ALTER TABLE "vehicles" ALTER COLUMN "category_id" SET NOT NULL;

DROP INDEX "vehicles_category_status_idx";
ALTER TABLE "vehicles" DROP COLUMN "category";
DROP TYPE "VehicleCategory";

CREATE INDEX "vehicles_category_id_status_idx" ON "vehicles"("category_id", "status");

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "vehicle_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Marques ------------------------------------------------------------------------------------

CREATE TABLE "vehicle_brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_brands_name_key" ON "vehicle_brands"("name");

-- Liste d'origine (parc tunisien de location), complétée des marques déjà saisies par les agences.
INSERT INTO "vehicle_brands" ("id", "name", "updated_at")
SELECT 'vb_' || substr(md5("name"), 1, 22), "name", CURRENT_TIMESTAMP
FROM (
  SELECT unnest(ARRAY[
    'Alfa Romeo', 'Audi', 'BAIC', 'BMW', 'BYD', 'Changan', 'Chery', 'Chevrolet', 'Citroën', 'Cupra',
    'Dacia', 'DFSK', 'DS', 'Fiat', 'Ford', 'Geely', 'GWM', 'Haval', 'Honda', 'Hyundai', 'Isuzu',
    'JAC', 'Jaguar', 'Jeep', 'Jetour', 'Kia', 'Land Rover', 'Lexus', 'Mahindra', 'Mazda',
    'Mercedes-Benz', 'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Porsche', 'Renault',
    'Seat', 'Skoda', 'SsangYong', 'Suzuki', 'Tata', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
    'Wallyscar'
  ]) AS "name"
  UNION
  SELECT DISTINCT "brand" FROM "vehicles"
) AS "brands"
ON CONFLICT ("name") DO NOTHING;

CREATE INDEX "vehicles_brand_idx" ON "vehicles"("brand");

-- Délégations et municipalités ----------------------------------------------------------------

CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "governorate_code" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delegations_governorate_code_name_fr_key" ON "delegations"("governorate_code", "name_fr");

ALTER TABLE "delegations" ADD CONSTRAINT "delegations_governorate_code_fkey"
  FOREIGN KEY ("governorate_code") REFERENCES "governorates"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "municipalities" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "municipalities_delegation_id_name_fr_key" ON "municipalities"("delegation_id", "name_fr");

ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_delegation_id_fkey"
  FOREIGN KEY ("delegation_id") REFERENCES "delegations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
