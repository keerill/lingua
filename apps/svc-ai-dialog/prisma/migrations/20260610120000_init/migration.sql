-- CreateTable
CREATE TABLE "dialog_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dialog_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dialog_turns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_text" TEXT NOT NULL,
    "ai_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dialog_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dialog_sessions_user_id_idx" ON "dialog_sessions"("user_id");

-- CreateIndex
CREATE INDEX "dialog_turns_session_id_created_at_idx" ON "dialog_turns"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_published_at_created_at_idx" ON "outbox"("published_at", "created_at");

-- AddForeignKey
ALTER TABLE "dialog_turns" ADD CONSTRAINT "dialog_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "dialog_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
