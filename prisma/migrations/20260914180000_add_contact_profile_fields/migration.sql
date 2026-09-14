
-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "followerCount" INTEGER,
ADD COLUMN     "isBusinessFollowingUser" BOOLEAN,
ADD COLUMN     "isFollowingBusiness" BOOLEAN,
ADD COLUMN     "isVerifiedUser" BOOLEAN,
ADD COLUMN     "lastInteractionAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT,
ADD COLUMN     "profilePicUrl" TEXT,
ADD COLUMN     "profileSyncedAt" TIMESTAMP(3);

