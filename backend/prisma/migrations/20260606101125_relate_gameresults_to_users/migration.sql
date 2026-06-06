/*
  Warnings:

  - Added the required column `userId` to the `GameResult` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "word" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "attempts" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "GameResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GameResult" ("attempts", "createdAt", "id", "success", "word") SELECT "attempts", "createdAt", "id", "success", "word" FROM "GameResult";
DROP TABLE "GameResult";
ALTER TABLE "new_GameResult" RENAME TO "GameResult";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
