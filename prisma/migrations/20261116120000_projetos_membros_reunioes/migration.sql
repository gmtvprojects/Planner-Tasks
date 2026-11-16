-- Renomeia Board -> Project preservando os dados.

-- Role: OWNER/ADMIN viram LEAD
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('LEAD', 'MEMBER');
ALTER TABLE "BoardMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "BoardMember" ALTER COLUMN "role" TYPE "Role_new"
  USING ((CASE WHEN "role"::text = 'MEMBER' THEN 'MEMBER' ELSE 'LEAD' END)::"Role_new");
ALTER TABLE "BoardMember" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
COMMIT;

-- Board -> Project
ALTER TABLE "Board" RENAME TO "Project";
ALTER TABLE "Project" RENAME CONSTRAINT "Board_pkey" TO "Project_pkey";

-- BoardMember -> ProjectMember
ALTER TABLE "BoardMember" RENAME TO "ProjectMember";
ALTER TABLE "ProjectMember" RENAME COLUMN "boardId" TO "projectId";
ALTER TABLE "ProjectMember" RENAME CONSTRAINT "BoardMember_pkey" TO "ProjectMember_pkey";
ALTER TABLE "ProjectMember" RENAME CONSTRAINT "BoardMember_boardId_fkey" TO "ProjectMember_projectId_fkey";
ALTER TABLE "ProjectMember" RENAME CONSTRAINT "BoardMember_userId_fkey" TO "ProjectMember_userId_fkey";

-- Column
ALTER TABLE "Column" RENAME COLUMN "boardId" TO "projectId";
ALTER TABLE "Column" RENAME CONSTRAINT "Column_boardId_fkey" TO "Column_projectId_fkey";
ALTER INDEX "Column_boardId_position_idx" RENAME TO "Column_projectId_position_idx";

-- Label
ALTER TABLE "Label" RENAME COLUMN "boardId" TO "projectId";
ALTER TABLE "Label" RENAME CONSTRAINT "Label_boardId_fkey" TO "Label_projectId_fkey";

-- User
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Meeting
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_MeetingAttendees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MeetingAttendees_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "Meeting_projectId_date_idx" ON "Meeting"("projectId", "date");
CREATE INDEX "_MeetingAttendees_B_index" ON "_MeetingAttendees"("B");

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_MeetingAttendees" ADD CONSTRAINT "_MeetingAttendees_A_fkey" FOREIGN KEY ("A") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_MeetingAttendees" ADD CONSTRAINT "_MeetingAttendees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
