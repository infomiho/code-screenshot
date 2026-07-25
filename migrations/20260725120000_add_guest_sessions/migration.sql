-- DropForeignKey
ALTER TABLE "Ambient" DROP CONSTRAINT "Ambient_ownerId_fkey";

-- AlterTable
ALTER TABLE "Ambient" ALTER COLUMN "ownerId" DROP NOT NULL,
ADD COLUMN "guestSessionId" TEXT;

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");

-- CreateIndex
CREATE INDEX "Ambient_guestSessionId_updatedAt_idx" ON "Ambient"("guestSessionId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Ambient" ADD CONSTRAINT "Ambient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ambient" ADD CONSTRAINT "Ambient_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An ambient belongs to a signed-in owner or to an anonymous browser session, never both and never
-- neither. Prisma cannot express this, and PostgreSQL evaluates CHECK per statement without allowing
-- DEFERRABLE, so handing an ambient from a guest session to an owner must happen in a single UPDATE.
ALTER TABLE "Ambient" ADD CONSTRAINT "ambient_owner_xor_guest"
CHECK (("ownerId" IS NULL) <> ("guestSessionId" IS NULL));
