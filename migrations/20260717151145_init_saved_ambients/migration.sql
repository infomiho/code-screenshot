-- CreateEnum
CREATE TYPE "AmbientStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "githubAvatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ambient" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AmbientStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ambient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbientDraft" (
    "ambientId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "document" JSONB NOT NULL,
    "designDirection" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmbientDraft_pkey" PRIMARY KEY ("ambientId")
);

-- CreateTable
CREATE TABLE "AmbientVersion" (
    "id" TEXT NOT NULL,
    "ambientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "draftRevision" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "certificationStatus" "CertificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmbientVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbientAgentSession" (
    "id" TEXT NOT NULL,
    "ambientId" TEXT NOT NULL,
    "capabilityHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmbientAgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "providerName" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerData" TEXT NOT NULL DEFAULT '{}',
    "authId" TEXT NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("providerName","providerUserId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ambient_ownerId_updatedAt_idx" ON "Ambient"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ambient_ownerId_slug_key" ON "Ambient"("ownerId", "slug");

-- CreateIndex
CREATE INDEX "AmbientVersion_ambientId_createdAt_idx" ON "AmbientVersion"("ambientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AmbientVersion_ambientId_version_key" ON "AmbientVersion"("ambientId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AmbientAgentSession_capabilityHash_key" ON "AmbientAgentSession"("capabilityHash");

-- CreateIndex
CREATE INDEX "AmbientAgentSession_ambientId_expiresAt_idx" ON "AmbientAgentSession"("ambientId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_userId_key" ON "Auth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Ambient" ADD CONSTRAINT "Ambient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbientDraft" ADD CONSTRAINT "AmbientDraft_ambientId_fkey" FOREIGN KEY ("ambientId") REFERENCES "Ambient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbientVersion" ADD CONSTRAINT "AmbientVersion_ambientId_fkey" FOREIGN KEY ("ambientId") REFERENCES "Ambient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbientAgentSession" ADD CONSTRAINT "AmbientAgentSession_ambientId_fkey" FOREIGN KEY ("ambientId") REFERENCES "Ambient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auth" ADD CONSTRAINT "Auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_authId_fkey" FOREIGN KEY ("authId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Auth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
