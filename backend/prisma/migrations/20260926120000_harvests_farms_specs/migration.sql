-- AlterTable
ALTER TABLE "ponds" ADD COLUMN     "aerators" INTEGER,
ADD COLUMN     "area_m2" DOUBLE PRECISION,
ADD COLUMN     "depth_m" DOUBLE PRECISION,
ADD COLUMN     "farm_id" INTEGER,
ADD COLUMN     "pond_type" TEXT,
ADD COLUMN     "target_weight_kg" DOUBLE PRECISION,
ADD COLUMN     "water_checked_at" TIMESTAMP(3),
ADD COLUMN     "water_note" TEXT,
ADD COLUMN     "water_source" TEXT,
ADD COLUMN     "water_status" TEXT;

-- CreateTable
CREATE TABLE "farms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvests" (
    "id" SERIAL NOT NULL,
    "pond_id" INTEGER NOT NULL,
    "cycle_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "total_kg" DOUBLE PRECISION NOT NULL,
    "boxes" DOUBLE PRECISION,
    "fish_count" INTEGER,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "recorded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harvests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvest_lines" (
    "id" SERIAL NOT NULL,
    "harvest_id" INTEGER NOT NULL,
    "grade_id" INTEGER NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "fish_count" INTEGER,

    CONSTRAINT "harvest_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_grades" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "min_kg" DOUBLE PRECISION,
    "max_kg" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "size_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "farms_name_key" ON "farms"("name");

-- CreateIndex
CREATE INDEX "harvests_pond_id_date_idx" ON "harvests"("pond_id", "date");

-- CreateIndex
CREATE INDEX "harvests_cycle_id_idx" ON "harvests"("cycle_id");

-- CreateIndex
CREATE INDEX "harvest_lines_harvest_id_idx" ON "harvest_lines"("harvest_id");

-- CreateIndex
CREATE INDEX "harvest_lines_grade_id_idx" ON "harvest_lines"("grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "size_grades_label_key" ON "size_grades"("label");

-- CreateIndex
CREATE INDEX "ponds_farm_id_idx" ON "ponds"("farm_id");

-- AddForeignKey
ALTER TABLE "ponds" ADD CONSTRAINT "ponds_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "pond_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_lines" ADD CONSTRAINT "harvest_lines_harvest_id_fkey" FOREIGN KEY ("harvest_id") REFERENCES "harvests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_lines" ADD CONSTRAINT "harvest_lines_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "size_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: every existing pond goes under one farm so the farm map has
-- something to show; the owner can rename it or add more farms.
INSERT INTO "farms" ("name") SELECT 'Main farm' WHERE EXISTS (SELECT 1 FROM "ponds");
UPDATE "ponds" SET "farm_id" = (SELECT "id" FROM "farms" WHERE "name" = 'Main farm') WHERE "farm_id" IS NULL;

-- The farm's size grades, named the way they are called on the farm: the
-- number is tenths of a kilogram per fish, so "7–9" is 0.7–0.9 kg.
INSERT INTO "size_grades" ("label", "min_kg", "max_kg", "sort_order") VALUES
  ('3–5', 0.3, 0.5, 1),
  ('5–7', 0.5, 0.7, 2),
  ('7–9', 0.7, 0.9, 3),
  ('9+', 0.9, NULL, 4);
-- Harvest box weight.
INSERT INTO "settings" ("key", "value") VALUES ('boxKg', '500');

-- Cycles closed before harvests were recorded individually become one final
-- harvest each, so the harvest log and dashboard include them.
INSERT INTO "harvests" ("pond_id", "cycle_id", "date", "total_kg", "fish_count", "is_final", "note")
SELECT "pond_id", "id", "ended_at", "harvest_kg", "fish_count", true, "note"
FROM "pond_cycles"
WHERE "outcome" = 'harvested' AND "harvest_kg" > 0;
