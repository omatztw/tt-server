-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AllocationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AllocationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AllocationRule" ("createdAt", "domain", "id", "processName", "projectId", "updatedAt", "userId") SELECT "createdAt", coalesce("domain", '') AS "domain", "id", "processName", "projectId", "updatedAt", "userId" FROM "AllocationRule";
DROP TABLE "AllocationRule";
ALTER TABLE "new_AllocationRule" RENAME TO "AllocationRule";
CREATE INDEX "AllocationRule_userId_idx" ON "AllocationRule"("userId");
CREATE UNIQUE INDEX "AllocationRule_userId_processName_domain_key" ON "AllocationRule"("userId", "processName", "domain");
CREATE TABLE "new_TimeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "processName" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "totalSeconds" INTEGER NOT NULL,
    "machineName" TEXT,
    "minDurationUsed" INTEGER NOT NULL DEFAULT 600,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimeRecord" ("createdAt", "date", "domain", "id", "machineName", "minDurationUsed", "processName", "totalSeconds", "userId") SELECT "createdAt", "date", coalesce("domain", '') AS "domain", "id", "machineName", "minDurationUsed", "processName", "totalSeconds", "userId" FROM "TimeRecord";
DROP TABLE "TimeRecord";
ALTER TABLE "new_TimeRecord" RENAME TO "TimeRecord";
CREATE INDEX "TimeRecord_userId_date_idx" ON "TimeRecord"("userId", "date");
CREATE UNIQUE INDEX "TimeRecord_userId_date_processName_domain_key" ON "TimeRecord"("userId", "date", "processName", "domain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
