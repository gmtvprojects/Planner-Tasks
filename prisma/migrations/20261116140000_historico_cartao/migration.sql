-- CreateTable
CREATE TABLE "CardEvent" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "fromTitle" TEXT,
    "toTitle" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardEvent_cardId_createdAt_idx" ON "CardEvent"("cardId", "createdAt");

-- AddForeignKey
ALTER TABLE "CardEvent" ADD CONSTRAINT "CardEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardEvent" ADD CONSTRAINT "CardEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cartões existentes ganham o evento de criação na aba onde estão agora
INSERT INTO "CardEvent" ("id", "cardId", "toTitle", "createdAt")
SELECT 'bf-' || c."id", c."id", col."title", c."createdAt"
FROM "Card" c JOIN "Column" col ON col."id" = c."columnId"
WHERE c."title" <> '';
