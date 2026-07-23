# Group-name encoding diagnosis

## Finding

The database contained 12 group names with a single, reversible mojibake layer: UTF-8 bytes had previously been decoded as Latin-1/Windows-1252 and then stored as UTF-8. The Flask API returned those stored values unchanged. Its response bodies decoded strictly as UTF-8, and the MySQL session used `utf8mb4` for client, connection, and results.

No original CSV, XLS, XLSX, TSV, or ODS source file was present in the project or its surrounding Documents folder. Consequently, no full import or bulk conversion was used. Each repair is constrained by `id` and the exact original `HEX(group_name)` value.

## Reviewed rows

| id | country | stored value | stored HEX | corrected value |
|---:|---|---|---|---|
| 83 | Guatemala | `Maya ItzÃ¡` | `4D6179612049747AC383C2A1` | `Maya Itzá` |
| 132 | Venezuela | `Piaroa/UwottÃ¼ja` | `506961726F612F55776F7474C383C2BC6A61` | `Piaroa/Uwottüja` |
| 141 | Venezuela | `Panare-Eye/E'Ã±epÃ¡` | `50616E6172652D4579652F4527C383C2B16570C383C2A1` | `Panare-Eye/E'ñepá` |
| 146 | Venezuela | `JotÃ¯` | `4A6F74C383C2AF` | `Jotï` |
| 231 | Brazil | `PipipÃ£` | `5069706970C383C2A3` | `Pipipã` |
| 234 | Brazil | `AikanÃ£` | `41696B616EC383C2A3` | `Aikanã` |
| 289 | Argentina | `WichÃ­` | `57696368C383C2AD` | `Wichí` |
| 559 | Cameroon | `BagyÃ©li` | `42616779C383C2A96C69` | `Bagyéli` |
| 574 | Cameroon | `PygmÃ©es Baka` | `5079676DC383C2A965732042616B61` | `Pygmées Baka` |
| 599 | Nigeria | `YakÃ¶/Yakurr` | `59616BC383C2B62F59616B757272` | `Yakö/Yakurr` |
| 1053 | Sudan | `Arab/Jaâaliyin` | `417261622F4A61C3A2C280C299616C6979696E` | `Arab/Ja'aliyin` |
| 1098 | Iraq | `KÃ¢kÃ¢'i` | `4BC383C2A26BC383C2A22769` | `Kâkâ'i` |

For 11 rows, decoding the stored string as Latin-1 bytes and then decoding those bytes as UTF-8 produced the corrected value and round-tripped exactly to the stored byte sequence. For id 1053, that process recovered a curly apostrophe; the straight-apostrophe spelling shown above was explicitly confirmed by the project owner.

## Controls

- `tradgov_groups_backup_before_encoding_fix` is created before any update.
- No `REPLACE`, table-wide `CONVERT`, re-import, or update without a primary key is used.
- `Vietnamese/Kinh` and the country value `Côte d'Ivoire` were checked as clean reference values and are not modified.
- The reusable `scripts/encoding_diagnosis.py` audit is read-only.
