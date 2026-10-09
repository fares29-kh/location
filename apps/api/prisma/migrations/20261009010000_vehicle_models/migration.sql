-- Modèles de véhicules par marque, gérés par l'administration (ex. BMW → Série 3, X6, M5).

CREATE TABLE "vehicle_models" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_models_brand_id_name_key" ON "vehicle_models"("brand_id", "name");

ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "vehicle_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Modèles courants du parc tunisien, complétés des modèles déjà saisis par les agences.
INSERT INTO "vehicle_models" ("id", "brand_id", "name", "updated_at")
SELECT 'vm_' || substr(md5(b."name" || '/' || m."model"), 1, 22), b."id", m."model", CURRENT_TIMESTAMP
FROM (
  VALUES
    ('Alfa Romeo', 'Giulia'), ('Alfa Romeo', 'Stelvio'), ('Alfa Romeo', 'Tonale'),
    ('Audi', 'A1'), ('Audi', 'A3'), ('Audi', 'A4'), ('Audi', 'A6'), ('Audi', 'Q2'), ('Audi', 'Q3'),
    ('Audi', 'Q5'), ('Audi', 'Q7'),
    ('BAIC', 'X35'), ('BAIC', 'X55'), ('BAIC', 'BJ40'),
    ('BMW', 'Série 1'), ('BMW', 'Série 2'), ('BMW', 'Série 3'), ('BMW', 'Série 5'), ('BMW', 'X1'),
    ('BMW', 'X3'), ('BMW', 'X5'), ('BMW', 'X6'), ('BMW', 'M5'),
    ('BYD', 'Atto 3'), ('BYD', 'Dolphin'), ('BYD', 'Seal'), ('BYD', 'Song Plus'),
    ('Changan', 'Alsvin'), ('Changan', 'CS35 Plus'), ('Changan', 'CS55 Plus'), ('Changan', 'UNI-K'),
    ('Chery', 'Arrizo 5'), ('Chery', 'Tiggo 2 Pro'), ('Chery', 'Tiggo 4 Pro'),
    ('Chery', 'Tiggo 7 Pro'), ('Chery', 'Tiggo 8 Pro'),
    ('Chevrolet', 'Spark'), ('Chevrolet', 'Aveo'), ('Chevrolet', 'Cruze'), ('Chevrolet', 'Captiva'),
    ('Citroën', 'C3'), ('Citroën', 'C3 Aircross'), ('Citroën', 'C4'), ('Citroën', 'C5 Aircross'),
    ('Citroën', 'C-Elysée'), ('Citroën', 'Berlingo'),
    ('Cupra', 'Formentor'), ('Cupra', 'Leon'),
    ('Dacia', 'Sandero'), ('Dacia', 'Sandero Stepway'), ('Dacia', 'Logan'), ('Dacia', 'Duster'),
    ('Dacia', 'Jogger'), ('Dacia', 'Spring'),
    ('DFSK', 'Glory 500'), ('DFSK', 'Glory 580'),
    ('DS', 'DS 3'), ('DS', 'DS 4'), ('DS', 'DS 7'),
    ('Fiat', 'Panda'), ('Fiat', '500'), ('Fiat', 'Tipo'), ('Fiat', 'Doblo'),
    ('Ford', 'Fiesta'), ('Ford', 'Focus'), ('Ford', 'Puma'), ('Ford', 'Kuga'), ('Ford', 'Ranger'),
    ('Geely', 'Coolray'), ('Geely', 'Emgrand'), ('Geely', 'Tugella'),
    ('GWM', 'Poer'), ('GWM', 'Wingle 7'),
    ('Haval', 'Jolion'), ('Haval', 'H6'),
    ('Honda', 'Jazz'), ('Honda', 'Civic'), ('Honda', 'HR-V'), ('Honda', 'CR-V'),
    ('Hyundai', 'i10'), ('Hyundai', 'Grand i10'), ('Hyundai', 'i20'), ('Hyundai', 'Accent'),
    ('Hyundai', 'Elantra'), ('Hyundai', 'Creta'), ('Hyundai', 'Kona'), ('Hyundai', 'Tucson'),
    ('Hyundai', 'Santa Fe'),
    ('Isuzu', 'D-Max'),
    ('JAC', 'J7'), ('JAC', 'JS4'), ('JAC', 'T8'),
    ('Jaguar', 'XE'), ('Jaguar', 'XF'), ('Jaguar', 'F-Pace'),
    ('Jeep', 'Renegade'), ('Jeep', 'Compass'), ('Jeep', 'Wrangler'), ('Jeep', 'Grand Cherokee'),
    ('Jetour', 'Dashing'), ('Jetour', 'X70'),
    ('Kia', 'Picanto'), ('Kia', 'Rio'), ('Kia', 'Ceed'), ('Kia', 'Cerato'), ('Kia', 'Stonic'),
    ('Kia', 'Seltos'), ('Kia', 'Sportage'), ('Kia', 'Sorento'),
    ('Land Rover', 'Defender'), ('Land Rover', 'Discovery Sport'),
    ('Land Rover', 'Range Rover Evoque'), ('Land Rover', 'Range Rover Sport'),
    ('Lexus', 'NX'), ('Lexus', 'RX'),
    ('Mahindra', 'Scorpio'), ('Mahindra', 'XUV300'),
    ('Mazda', 'Mazda2'), ('Mazda', 'Mazda3'), ('Mazda', 'CX-3'), ('Mazda', 'CX-5'),
    ('Mercedes-Benz', 'Classe A'), ('Mercedes-Benz', 'Classe C'), ('Mercedes-Benz', 'Classe E'),
    ('Mercedes-Benz', 'CLA'), ('Mercedes-Benz', 'GLA'), ('Mercedes-Benz', 'GLC'),
    ('Mercedes-Benz', 'Classe V'),
    ('MG', 'MG ZS'), ('MG', 'MG 5'), ('MG', 'MG4'), ('MG', 'HS'),
    ('Mini', 'Cooper'), ('Mini', 'Countryman'),
    ('Mitsubishi', 'Space Star'), ('Mitsubishi', 'ASX'), ('Mitsubishi', 'Outlander'),
    ('Mitsubishi', 'L200'),
    ('Nissan', 'Micra'), ('Nissan', 'Juke'), ('Nissan', 'Qashqai'), ('Nissan', 'X-Trail'),
    ('Nissan', 'Navara'),
    ('Opel', 'Corsa'), ('Opel', 'Astra'), ('Opel', 'Crossland'), ('Opel', 'Mokka'),
    ('Opel', 'Grandland'),
    ('Peugeot', '108'), ('Peugeot', '208'), ('Peugeot', '2008'), ('Peugeot', '301'),
    ('Peugeot', '308'), ('Peugeot', '3008'), ('Peugeot', '408'), ('Peugeot', '508'),
    ('Peugeot', '5008'), ('Peugeot', 'Partner'), ('Peugeot', 'Rifter'),
    ('Porsche', 'Macan'), ('Porsche', 'Cayenne'), ('Porsche', 'Panamera'),
    ('Renault', 'Clio'), ('Renault', 'Clio 5'), ('Renault', 'Symbol'), ('Renault', 'Mégane'),
    ('Renault', 'Captur'), ('Renault', 'Kadjar'), ('Renault', 'Arkana'), ('Renault', 'Austral'),
    ('Renault', 'Kangoo'),
    ('Seat', 'Ibiza'), ('Seat', 'Leon'), ('Seat', 'Arona'), ('Seat', 'Ateca'),
    ('Skoda', 'Fabia'), ('Skoda', 'Octavia'), ('Skoda', 'Kamiq'), ('Skoda', 'Karoq'),
    ('Skoda', 'Kodiaq'),
    ('SsangYong', 'Tivoli'), ('SsangYong', 'Korando'), ('SsangYong', 'Rexton'),
    ('Suzuki', 'Celerio'), ('Suzuki', 'Swift'), ('Suzuki', 'Dzire'), ('Suzuki', 'Baleno'),
    ('Suzuki', 'Vitara'), ('Suzuki', 'S-Cross'), ('Suzuki', 'Jimny'),
    ('Tata', 'Tiago'), ('Tata', 'Nexon'),
    ('Tesla', 'Model 3'), ('Tesla', 'Model Y'),
    ('Toyota', 'Yaris'), ('Toyota', 'Yaris Cross'), ('Toyota', 'Corolla'), ('Toyota', 'C-HR'),
    ('Toyota', 'RAV4'), ('Toyota', 'Hilux'), ('Toyota', 'Land Cruiser'),
    ('Volkswagen', 'Polo'), ('Volkswagen', 'Golf'), ('Volkswagen', 'Jetta'),
    ('Volkswagen', 'Passat'), ('Volkswagen', 'T-Cross'), ('Volkswagen', 'T-Roc'),
    ('Volkswagen', 'Tiguan'), ('Volkswagen', 'Touareg'), ('Volkswagen', 'Caddy'),
    ('Volvo', 'S60'), ('Volvo', 'XC40'), ('Volvo', 'XC60'), ('Volvo', 'XC90'),
    ('Wallyscar', 'Izis'), ('Wallyscar', '719')
  UNION
  SELECT DISTINCT "brand", "model" FROM "vehicles"
) AS m("brand", "model")
JOIN "vehicle_brands" b ON b."name" = m."brand"
ON CONFLICT DO NOTHING;
