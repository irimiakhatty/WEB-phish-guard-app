-- Backfill organization departments with a default "Unassigned" bucket.
-- Run after schema push that introduces organization_department and department_id columns.

INSERT INTO "organization_department" ("id", "organizationId", "name", "name_normalized", "createdAt", "updatedAt")
SELECT
  concat('dept_unassigned_', o."id"),
  o."id",
  'Unassigned',
  'unassigned',
  NOW(),
  NOW()
FROM "organization" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "organization_department" d
  WHERE d."organizationId" = o."id"
    AND d."name_normalized" = 'unassigned'
);

UPDATE "organization_member" m
SET "department_id" = d."id"
FROM "organization_department" d
WHERE m."organizationId" = d."organizationId"
  AND d."name_normalized" = 'unassigned'
  AND m."department_id" IS NULL;

UPDATE "scan" s
SET "department_id" = m."department_id"
FROM "organization_member" m
WHERE s."organizationId" = m."organizationId"
  AND s."userId" = m."userId"
  AND s."organizationId" IS NOT NULL
  AND s."department_id" IS NULL
  AND m."department_id" IS NOT NULL;
