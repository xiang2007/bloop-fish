-- AlterTable
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "auth_throttle" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_throttle_pkey" PRIMARY KEY ("key")
);
