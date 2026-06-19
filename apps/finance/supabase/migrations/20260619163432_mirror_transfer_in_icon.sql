-- Mirror the "Transfer In" group's icon to match "Transfer Out".
-- Transfer Out uses Fi/FiArrowUpRight (an up-right arrow); give Transfer
-- In the mirrored Fi/FiArrowDownLeft so incoming and outgoing transfers
-- read as a matched pair instead of two unrelated glyphs (the old
-- Tb/TbArrowBarToRight looked nothing like the out-arrow).
update category_groups
set icon_lib = 'Fi', icon_name = 'FiArrowDownLeft'
where name = 'Transfer In';
