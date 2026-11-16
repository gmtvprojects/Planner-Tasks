-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CardAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CardAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- Preserva o responsável único anterior como responsável múltiplo
INSERT INTO "_CardAssignees" ("A", "B")
SELECT "id", "assigneeId" FROM "Card" WHERE "assigneeId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_assigneeId_fkey";

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "assigneeId";

-- CreateIndex
CREATE INDEX "ChecklistItem_cardId_position_idx" ON "ChecklistItem"("cardId", "position");

-- CreateIndex
CREATE INDEX "_CardAssignees_B_index" ON "_CardAssignees"("B");

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CardAssignees" ADD CONSTRAINT "_CardAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CardAssignees" ADD CONSTRAINT "_CardAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
