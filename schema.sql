-- =============================================================================
-- CARE AI Sonologist Companion™ — SQLite Schema
-- Generated from Prisma schema for docker-entrypoint.sh DB setup
-- Each statement uses IF NOT EXISTS for safe re-runs
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "uhid" TEXT NOT NULL,
    "referringDoctor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Study" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyUid" TEXT NOT NULL,
    "studyDate" DATETIME NOT NULL,
    "studyType" TEXT NOT NULL,
    "studyDesc" TEXT,
    "machine" TEXT NOT NULL DEFAULT 'GE Voluson E9',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "patientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Study_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesUid" TEXT NOT NULL,
    "seriesDesc" TEXT,
    "seriesNumber" INTEGER NOT NULL,
    "modality" TEXT NOT NULL DEFAULT 'US',
    "studyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Series_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DicomImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sopUid" TEXT NOT NULL,
    "sopClassUid" TEXT,
    "instanceNumber" INTEGER NOT NULL,
    "seriesId" TEXT NOT NULL,
    "imageType" TEXT,
    "qualityScore" REAL,
    "aiLabel" TEXT,
    "thumbnailPath" TEXT,
    "filePath" TEXT,
    "isKeyImage" BOOLEAN NOT NULL DEFAULT 0,
    "isApproved" BOOLEAN NOT NULL DEFAULT 0,
    "frameNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DicomImage_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Measurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gestationalAge" TEXT,
    "percentile" REAL,
    "source" TEXT NOT NULL DEFAULT 'dicom_sr',
    "confidence" REAL,
    "sopUid" TEXT,
    "seriesUid" TEXT,
    "frameNumber" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT 0,
    "isEdited" BOOLEAN NOT NULL DEFAULT 0,
    "originalValue" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Measurement_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "clinicalInfo" TEXT,
    "findings" TEXT NOT NULL DEFAULT '',
    "impression" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT,
    "technique" TEXT,
    "comparison" TEXT,
    "reportStatus" TEXT NOT NULL DEFAULT 'draft',
    "signedBy" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AiSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "isDismissed" BOOLEAN NOT NULL DEFAULT 0,
    "isAccepted" BOOLEAN,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSuggestion_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "KeyImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "imageId" TEXT,
    "category" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "isApproved" BOOLEAN NOT NULL DEFAULT 0,
    "aiScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeyImage_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PcpndtForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "studyId" TEXT,
    "formNumber" TEXT,
    "formDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "husbandName" TEXT,
    "husbandAge" INTEGER,
    "husbandAddress" TEXT,
    "referral" TEXT,
    "lmp" DATETIME,
    "edd" DATETIME,
    "currentGa" TEXT,
    "gravida" INTEGER,
    "para" INTEGER,
    "living" INTEGER,
    "abortion" INTEGER,
    "previousUsg" TEXT,
    "previousUsgDate" DATETIME,
    "previousGa" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "sexDetermined" TEXT,
    "formStatus" TEXT NOT NULL DEFAULT 'draft',
    "signedBy" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PcpndtForm_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DoctorPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "studyType" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "phrases" TEXT NOT NULL,
    "recommendations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_uhid_key" ON "Patient"("uhid");
CREATE UNIQUE INDEX IF NOT EXISTS "Study_studyUid_key" ON "Study"("studyUid");
CREATE UNIQUE INDEX IF NOT EXISTS "DicomImage_sopUid_key" ON "DicomImage"("sopUid");
CREATE UNIQUE INDEX IF NOT EXISTS "Report_studyId_key" ON "Report"("studyId");

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS "Study_patientId_idx" ON "Study"("patientId");
CREATE INDEX IF NOT EXISTS "Study_status_idx" ON "Study"("status");
CREATE INDEX IF NOT EXISTS "Study_studyType_idx" ON "Study"("studyType");
CREATE INDEX IF NOT EXISTS "Measurement_studyId_idx" ON "Measurement"("studyId");
CREATE INDEX IF NOT EXISTS "AiSuggestion_studyId_idx" ON "AiSuggestion"("studyId");
CREATE INDEX IF NOT EXISTS "Series_studyId_idx" ON "Series"("studyId");
CREATE INDEX IF NOT EXISTS "DicomImage_seriesId_idx" ON "DicomImage"("seriesId");
CREATE INDEX IF NOT EXISTS "KeyImage_studyId_idx" ON "KeyImage"("studyId");
CREATE INDEX IF NOT EXISTS "PcpndtForm_patientId_idx" ON "PcpndtForm"("patientId");
CREATE INDEX IF NOT EXISTS "AuditLog_studyId_idx" ON "AuditLog"("studyId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");