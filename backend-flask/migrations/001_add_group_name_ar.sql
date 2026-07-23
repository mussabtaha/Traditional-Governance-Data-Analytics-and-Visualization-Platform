-- Add optional, manually reviewed Arabic group names.
-- This migration is idempotent and can be run more than once safely.

SET @group_name_ar_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tradgov_groups'
      AND column_name = 'group_name_ar'
);

SET @group_name_ar_migration = IF(
    @group_name_ar_exists = 0,
    'ALTER TABLE `tradgov_groups` ADD COLUMN `group_name_ar` VARCHAR(255) NULL AFTER `group_name`',
    'SELECT ''group_name_ar already exists; no schema change was required.'' AS migration_status'
);

PREPARE group_name_ar_statement FROM @group_name_ar_migration;
EXECUTE group_name_ar_statement;
DEALLOCATE PREPARE group_name_ar_statement;

