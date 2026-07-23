-- Add Arabic names here only after a fluent reviewer has approved them.
-- Keep group_name unchanged: it is the original English/source name.
-- Prefer matching both id and group_name so updates remain precise.

START TRANSACTION;

-- Template (remove the leading "--" only after replacing every placeholder):
-- UPDATE tradgov_groups
-- SET group_name_ar = '<reviewed Arabic group name>'
-- WHERE id = <verified group id>
--   AND group_name = '<verified English/source group name>';

-- Review pending changes before committing:
-- SELECT id, group_name, group_name_ar
-- FROM tradgov_groups
-- WHERE group_name_ar IS NOT NULL
-- ORDER BY group_name;

-- Replace ROLLBACK with COMMIT only after reviewing the result.
ROLLBACK;

