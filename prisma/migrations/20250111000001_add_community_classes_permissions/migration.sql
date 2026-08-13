-- Add Community Classes permission fields to Role model
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewCommunityClasses" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewCommunityClassesClasses" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewCommunityClassesClients" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewCommunityClassesInvoices" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "canViewCommunityClassesEmailQueue" BOOLEAN NOT NULL DEFAULT false;
