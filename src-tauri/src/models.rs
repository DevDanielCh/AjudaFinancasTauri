use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BreakdownRow {
    pub name: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DashboardData {
    pub month: String,
    pub income: i64,
    pub expenses: i64,
    pub balance: i64,
    pub prev_balance: i64,
    pub income_by_cat: Vec<BreakdownRow>,
    pub expenses_by_pm: Vec<BreakdownRow>,
    /// Percentual configurado das receitas destinado a investimentos (0–100).
    pub meta_investimento: f64,
    /// Aportes à reserva (type 4) no mês.
    pub aportes: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MonthlyPoint {
    pub month: String,
    pub income: i64,
    pub expenses: i64,
    pub balance: i64,
    /// Saldo da reserva/investimentos no fim do mês (histórico completo).
    pub reserva: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChartData {
    pub monthly: Vec<MonthlyPoint>,
    pub expenses_by_cat: Vec<BreakdownRow>,
    pub expenses_by_pm: Vec<BreakdownRow>,
}
