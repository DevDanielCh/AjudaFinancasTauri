-- Corrige end_month de parcelas com dados legados (calculado do start_month
-- do formulário em vez do mês da compra). end_month = start + (parcelas - 1).
UPDATE fixed_bills
SET end_month = strftime(
        '%Y-%m',
        date(start_month || '-01', printf('+%d months', installments - 1))
    )
WHERE installments IS NOT NULL AND installments > 0;
