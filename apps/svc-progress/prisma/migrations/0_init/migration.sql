-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "card_state" (
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "learned_at" TIMESTAMP(3),

    CONSTRAINT "card_state_pkey" PRIMARY KEY ("user_id","card_id")
);

-- CreateTable
CREATE TABLE "daily_activity" (
    "user_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "learned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateTable
CREATE TABLE "pronunciation_daily" (
    "user_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mistakes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pronunciation_daily_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "card_state_user_id_idx" ON "card_state"("user_id");

