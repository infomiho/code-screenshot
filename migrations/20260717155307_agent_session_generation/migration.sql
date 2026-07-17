/*
  Warnings:

  - A unique constraint covering the columns `[ambientId,draftRevision]` on the table `AmbientVersion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `generation` to the `AmbientAgentSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ambient" ADD COLUMN     "agentSessionGeneration" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AmbientAgentSession" ADD COLUMN     "generation" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AmbientVersion_ambientId_draftRevision_key" ON "AmbientVersion"("ambientId", "draftRevision");
