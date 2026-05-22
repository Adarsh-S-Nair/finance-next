-- Fixed vs flexible spending classification. A "fixed" group is a
-- recurring obligation with a stable monthly amount the user can't
-- meaningfully reduce in the short term (rent, mortgage, loan
-- payments). Everything else defaults to flexible/discretionary.
-- Dashboard uses this to keep dominant fixed payments (e.g. a
-- mortgage) from crowding the spending-breakdown donut, and to offer
-- a "flexible vs total" lens on the spending section.
--
-- Conservative defaults: only the two unambiguous fixed groups are
-- flagged. Mixed groups (Transportation, Medical, Government) stay
-- flexible; per-category override can come later.
ALTER TABLE category_groups
  ADD COLUMN is_fixed BOOLEAN NOT NULL DEFAULT false;

UPDATE category_groups
  SET is_fixed = true
  WHERE name IN ('Loan Payments', 'Rent and Utilities');
