-- Extend existing finite entitlements by the difference between the old and new trial lengths.
UPDATE `members` SET `paid_until` = `paid_until` + 1987200000
WHERE `permanent` = 0 AND `paid_until` > 0;
