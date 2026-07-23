-- Reviewed, row-level repair for the 12 confirmed mojibake group names.
-- Run with a utf8mb4 client. Every UPDATE is guarded by both the primary key
-- and the exact pre-repair byte sequence so correct or subsequently edited
-- values cannot be overwritten.

SET NAMES utf8mb4;

-- Create this backup once, before applying any correction.
CREATE TABLE tradgov_groups_backup_before_encoding_fix AS
SELECT * FROM tradgov_groups;

START TRANSACTION;

UPDATE tradgov_groups SET group_name = 'Maya Itzá'
WHERE id = 83 AND HEX(group_name) = '4D6179612049747AC383C2A1';

UPDATE tradgov_groups SET group_name = 'Piaroa/Uwottüja'
WHERE id = 132 AND HEX(group_name) = '506961726F612F55776F7474C383C2BC6A61';

UPDATE tradgov_groups SET group_name = 'Panare-Eye/E''ñepá'
WHERE id = 141 AND HEX(group_name) = '50616E6172652D4579652F4527C383C2B16570C383C2A1';

UPDATE tradgov_groups SET group_name = 'Jotï'
WHERE id = 146 AND HEX(group_name) = '4A6F74C383C2AF';

UPDATE tradgov_groups SET group_name = 'Pipipã'
WHERE id = 231 AND HEX(group_name) = '5069706970C383C2A3';

UPDATE tradgov_groups SET group_name = 'Aikanã'
WHERE id = 234 AND HEX(group_name) = '41696B616EC383C2A3';

UPDATE tradgov_groups SET group_name = 'Wichí'
WHERE id = 289 AND HEX(group_name) = '57696368C383C2AD';

UPDATE tradgov_groups SET group_name = 'Bagyéli'
WHERE id = 559 AND HEX(group_name) = '42616779C383C2A96C69';

UPDATE tradgov_groups SET group_name = 'Pygmées Baka'
WHERE id = 574 AND HEX(group_name) = '5079676DC383C2A965732042616B61';

UPDATE tradgov_groups SET group_name = 'Yakö/Yakurr'
WHERE id = 599 AND HEX(group_name) = '59616BC383C2B62F59616B757272';

-- The straight apostrophe spelling below was explicitly confirmed by the
-- project owner; it intentionally differs from the recovered curly apostrophe.
UPDATE tradgov_groups SET group_name = 'Arab/Ja''aliyin'
WHERE id = 1053 AND HEX(group_name) = '417261622F4A61C3A2C280C299616C6979696E';

UPDATE tradgov_groups SET group_name = 'Kâkâ''i'
WHERE id = 1098 AND HEX(group_name) = '4BC383C2A26BC383C2A22769';

COMMIT;

-- Post-migration review.
SELECT id, country, group_name, HEX(group_name) AS group_name_hex
FROM tradgov_groups
WHERE id IN (83, 132, 141, 146, 231, 234, 289, 559, 574, 599, 1053, 1098)
ORDER BY id;
