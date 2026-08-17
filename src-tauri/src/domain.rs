pub const FINISHED_GUARD_SQL: &str = "fb.installments IS NULL OR \
((CAST(strftime('%Y', t.date) AS INTEGER) * 12 + CAST(strftime('%m', t.date) AS INTEGER)) \
- (CAST(substr(fb.start_month, 1, 4) AS INTEGER) * 12 + CAST(substr(fb.start_month, 6, 2) AS INTEGER))) \
< fb.installments";
