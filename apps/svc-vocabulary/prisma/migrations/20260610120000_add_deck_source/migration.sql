-- AlterTable
ALTER TABLE "decks" ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "decks_owner_id_source_key" ON "decks"("owner_id", "source");
