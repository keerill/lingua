-- carry W3C trace-context on outbox rows so the end-to-end trace
-- survives the async outbox→Kafka publish gap.
-- AlterTable
ALTER TABLE "outbox" ADD COLUMN "headers" JSONB;
