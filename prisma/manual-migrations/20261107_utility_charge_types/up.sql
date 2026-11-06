-- Apply before deploying the application that writes the new charge types.
-- Keep both enum values on rollback; older application versions do not support these rows.
ALTER TYPE "UtilityType" ADD VALUE IF NOT EXISTS 'WASTE';
ALTER TYPE "UtilityType" ADD VALUE IF NOT EXISTS 'SECURITY';
