-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ponds" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "stocked_at" TIMESTAMP(3),
    "stocked_count" INTEGER,
    "cycle_months" INTEGER NOT NULL DEFAULT 8,
    "assumed_fcr" DOUBLE PRECISION NOT NULL DEFAULT 1.35,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ponds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pond_cycles" (
    "id" SERIAL NOT NULL,
    "pond_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "stocked_at" TIMESTAMP(3) NOT NULL,
    "stocked_count" INTEGER,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "harvest_kg" DOUBLE PRECISION,
    "fish_count" INTEGER,
    "cause" TEXT,
    "note" TEXT,
    "feed_kg" DOUBLE PRECISION NOT NULL,
    "feed_cost_rm" DOUBLE PRECISION NOT NULL,
    "dead_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pond_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "pack_size_kg" DOUBLE PRECISION NOT NULL,
    "price_per_kg" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "feed_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_logs" (
    "id" SERIAL NOT NULL,
    "pond_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "feed_type_id" INTEGER,
    "bags" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feed_kg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feed_cost_rm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dead_count" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "recorded_by" TEXT,
    "source" TEXT NOT NULL DEFAULT 'app',
    "import_batch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samplings" (
    "id" SERIAL NOT NULL,
    "pond_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "avg_weight_kg" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER,
    "note" TEXT,
    "recorded_by" TEXT,
    "source" TEXT NOT NULL DEFAULT 'app',
    "import_batch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "samplings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "feed_type_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "bags" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "pond_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "findings" TEXT NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ponds_name_key" ON "ponds"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pond_cycles_pond_id_number_key" ON "pond_cycles"("pond_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "feed_types_code_key" ON "feed_types"("code");

-- CreateIndex
CREATE INDEX "daily_logs_feed_type_id_idx" ON "daily_logs"("feed_type_id");

-- CreateIndex
CREATE INDEX "daily_logs_import_batch_id_idx" ON "daily_logs"("import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_logs_pond_id_date_key" ON "daily_logs"("pond_id", "date");

-- CreateIndex
CREATE INDEX "samplings_pond_id_date_idx" ON "samplings"("pond_id", "date");

-- CreateIndex
CREATE INDEX "samplings_import_batch_id_idx" ON "samplings"("import_batch_id");

-- CreateIndex
CREATE INDEX "stock_movements_feed_type_id_date_idx" ON "stock_movements"("feed_type_id", "date");

-- CreateIndex
CREATE INDEX "import_batches_pond_id_idx" ON "import_batches"("pond_id");

-- AddForeignKey
ALTER TABLE "pond_cycles" ADD CONSTRAINT "pond_cycles_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_feed_type_id_fkey" FOREIGN KEY ("feed_type_id") REFERENCES "feed_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samplings" ADD CONSTRAINT "samplings_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samplings" ADD CONSTRAINT "samplings_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_feed_type_id_fkey" FOREIGN KEY ("feed_type_id") REFERENCES "feed_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_pond_id_fkey" FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

