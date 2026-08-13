use serde::{Deserialize, Serialize};

fn month_str_to_date(s: &str) -> Result<chrono::NaiveDate, String> {
    chrono::NaiveDate::parse_from_str(&format!("{s}-01"), "%Y-%m-%d")
        .map_err(|_| format!("mês inválido: {s}"))
}

pub fn add_months(s: &str, n: u32) -> String {
    let d = month_str_to_date(s).unwrap();
    d.checked_add_months(chrono::Months::new(n))
        .unwrap()
        .format("%Y-%m")
        .to_string()
}

// ---- Inputs (create/update) ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInput {
    pub description: String,
    pub amount: i64,
    #[serde(rename = "type")]
    pub type_: i64,
    pub date: String,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
    /// 0 = crédito, 1 = débito. Só tem efeito quando o tipo é despesa (2)
    /// e a forma de pagamento é cartão.
    #[serde(default)]
    pub card_mode: i64,
}

impl TransactionInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("descrição é obrigatória".into());
        }
        if self.amount <= 0 {
            return Err("valor deve ser maior que zero".into());
        }
        if !matches!(self.type_, 1 | 2 | 4 | 5) {
            return Err("tipo deve ser receita (1), despesa (2), adição à reserva (4) ou remoção (5)".into());
        }
        if chrono::NaiveDate::parse_from_str(&self.date, "%Y-%m-%d").is_err() {
            return Err("data inválida".into());
        }
        if self.type_ == 2 && self.payment_method_id.is_none() {
            return Err("forma de pagamento é obrigatória para despesas".into());
        }
        if self.card_mode != 0 && self.card_mode != 1 {
            return Err("modo de cartão inválido".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentMethodInput {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub close_day: Option<i64>,
    pub validity_day: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryInput {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub color: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixedBillInput {
    pub description: String,
    pub amount: i64,
    pub day: i64,
    pub category_id: Option<i64>,
    pub payment_method_id: i64,
    pub start_month: String,
    pub end_month: Option<String>,
    pub installments: Option<i64>,
    pub purchase_date: Option<String>,
}

impl FixedBillInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("descrição é obrigatória".into());
        }
        if self.amount <= 0 {
            return Err("valor deve ser maior que zero".into());
        }
        if let Some(pd) = &self.purchase_date {
            chrono::NaiveDate::parse_from_str(pd, "%Y-%m-%d")
                .map_err(|_| "data da compra inválida".to_string())?;
        } else {
            if !(1..=31).contains(&self.day) {
                return Err("dia deve estar entre 1 e 31".into());
            }
            month_str_to_date(&self.start_month)?;
        }
        if let Some(end) = &self.end_month {
            month_str_to_date(end)?;
            if end < &self.start_month {
                return Err("data de fim deve ser posterior ao início".into());
            }
        }
        if let Some(n) = self.installments {
            if n < 2 {
                return Err("quantidade de parcelas deve ser maior ou igual a 2".into());
            }
        }
        Ok(())
    }

    /// Normaliza: parcelas definem end_month.
    pub fn normalized(&self) -> Result<Self, String> {
        let mut b = self.clone();
        if let Some(n) = b.installments {
            b.end_month = Some(add_months(&b.start_month, n as u32 - 1));
        }
        Ok(b)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoanInput {
    #[serde(rename = "type")]
    pub type_: i64,
    pub description: String,
    pub principal: i64,
    pub installment: i64,
    pub total_installments: i64,
    pub day: i64,
    pub start_month: String,
    pub payment_method_id: i64,
    /// Taxa mensal (fração, ex.: 0.0192 = 1,92% a.m.). 0 = derivar da parcela.
    pub monthly_rate: f64,
}

impl LoanInput {
    pub fn validate(&self) -> Result<(), String> {
        if self.description.trim().is_empty() {
            return Err("descrição é obrigatória".into());
        }
        if self.type_ != 1 && self.type_ != 2 {
            return Err("tipo inválido".into());
        }
        if self.principal <= 0 {
            return Err("valor deve ser maior que zero".into());
        }
        if self.installment <= 0 {
            return Err("valor da parcela deve ser maior que zero".into());
        }
        if self.total_installments < 2 {
            return Err("número de parcelas deve ser maior ou igual a 2".into());
        }
        if !(1..=31).contains(&self.day) {
            return Err("dia deve estar entre 1 e 31".into());
        }
        if !(0.0..1.0).contains(&self.monthly_rate) {
            return Err("taxa mensal inválida".into());
        }
        month_str_to_date(&self.start_month)?;
        if self.total_paid() < self.principal {
            return Err("total das parcelas deve ser maior ou igual ao valor".into());
        }
        Ok(())
    }

    pub fn total_paid(&self) -> i64 {
        self.installment * self.total_installments
    }

    pub fn end_month(&self) -> String {
        add_months(&self.start_month, self.total_installments as u32 - 1)
    }
}

// ---- Row DTOs (listas/detalhe) ----

#[derive(Debug, Clone, Serialize)]
pub struct PaymentMethod {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub metadata: Option<String>,
}

impl PaymentMethod {
    /// close_day do cartão a partir do metadata JSON, ou None.
    pub fn card_close_day(&self) -> Option<i64> {
        if self.type_ != 2 {
            return None;
        }
        let meta: Option<serde_json::Value> = self
            .metadata
            .as_deref()
            .and_then(|m| serde_json::from_str(m).ok());
        meta.and_then(|v| v.get("close_day")?.as_i64())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: i64,
    pub color: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransactionRow {
    pub id: i64,
    pub description: String,
    pub amount: i64,
    #[serde(rename = "type")]
    pub type_: i64,
    pub date: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub payment_method_id: Option<i64>,
    pub payment_method_name: Option<String>,
    pub fixed_bill_id: Option<i64>,
    pub loan_id: Option<i64>,
    pub is_card_bill: bool,
    /// 0 = crédito, 1 = débito.
    pub card_mode: i64,
    /// "n/total" quando a compra é parcela de conta fixa, senão None.
    pub installment: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CardBillDetail {
    pub id: i64,
    pub description: String,
    pub payment_method_name: String,
    pub period_start: String,
    pub period_end: String,
    pub due_date: String,
    pub total: i64,
    pub transactions: Vec<TransactionRow>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FixedBill {
    pub id: i64,
    pub description: String,
    pub amount: i64,
    pub day: i64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub payment_method_id: i64,
    pub payment_method_name: String,
    pub start_month: String,
    pub end_month: Option<String>,
    pub installments: Option<i64>,
    pub purchase_date: Option<String>,
    /// Verdadeiro quando todas as parcelas já venceram (parcelamento encerrado).
    pub finished: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct Loan {
    pub id: i64,
    #[serde(rename = "type")]
    pub type_: i64,
    pub description: String,
    pub principal: i64,
    pub installment: i64,
    pub total_installments: i64,
    pub day: i64,
    pub start_month: String,
    pub payment_method_id: i64,
    pub payment_method_name: String,
    pub total_paid: i64,
    pub total_interest: i64,
    pub end_month: String,
    pub paid_count: i64,
    /// Taxa mensal contratada (fração) usada na tabela de amortização.
    pub monthly_rate: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AmortizationRow {
    pub number: i64,
    pub month: String,
    pub installment: i64,
    pub interest: i64,
    pub principal: i64,
    pub balance: i64,
    /// Valor de liquidação antecipada hoje (VP da parcela na taxa contratada), 0 se vencida.
    pub settlement: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct LoanDetail {
    pub loan: Loan,
    pub schedule: Vec<AmortizationRow>,
}

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
