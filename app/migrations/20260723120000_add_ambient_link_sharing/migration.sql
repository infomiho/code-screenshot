ALTER TABLE "Ambient"
ADD COLUMN "shareId" TEXT,
ADD COLUMN "linkSharingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Ambient_shareId_key" ON "Ambient"("shareId");
