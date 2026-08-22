use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{with_db_active, AppState};
use crate::shared::util::{current_month, db_err, month_str_to_date};

// ---- Configurações ----

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    #[serde(default)]
    pub primeiro_mes: Option<String>,
    #[serde(default)]
    pub saldo_inicial_conta: i64,
    #[serde(default)]
    pub saldo_inicial_reserva: i64,
    #[serde(default)]
    pub meta_investimento: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsInput {
    #[serde(default)]
    pub primeiro_mes: Option<String>,
    #[serde(default)]
    pub saldo_inicial_conta: i64,
    #[serde(default)]
    pub saldo_inicial_reserva: i64,
    #[serde(default)]
    pub meta_investimento: f64,
}

impl SettingsInput {
    pub fn validate(&self) -> Result<(), String> {
        if let Some(pm) = &self.primeiro_mes {
            month_str_to_date(pm)?;
            if pm > &chrono::Local::now().format("%Y-%m").to_string() {
                return Err("primeiro mês não pode ser no futuro".into());
            }
        }
        if self.saldo_inicial_conta < 0 || self.saldo_inicial_reserva < 0 {
            return Err("saldos não podem ser negativos".into());
        }
        if !(0.0..=100.0).contains(&self.meta_investimento) {
            return Err("meta de investimento deve ser entre 0 e 100".into());
        }
        Ok(())
    }
}

/// Lê as configurações da conta; ausência = defaults (None, 0, 0).
pub fn get_settings_impl(conn: &Connection, account_id: i64) -> Result<Settings, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings WHERE account_id = ?1")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([account_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let mut s = Settings::default();
    for (k, v) in rows {
        match k.as_str() {
            "primeiro_mes" => s.primeiro_mes = Some(v),
            "saldo_inicial_conta" => s.saldo_inicial_conta = v.parse().unwrap_or(0),
            "saldo_inicial_reserva" => s.saldo_inicial_reserva = v.parse().unwrap_or(0),
            "meta_investimento" => s.meta_investimento = v.parse().unwrap_or(0.0),
            _ => {}
        }
    }
    Ok(s)
}

/// Persiste as configurações (primeiro_mes None remove a chave).
pub fn set_settings(conn: &Connection, account_id: i64, input: &SettingsInput) -> Result<(), String> {
    conn.execute(
        "DELETE FROM settings WHERE key = 'primeiro_mes' AND account_id = ?1",
        [account_id],
    )
    .map_err(db_err)?;
    if let Some(pm) = &input.primeiro_mes {
        conn.execute(
            "INSERT INTO settings (account_id, key, value) VALUES (?1, 'primeiro_mes', ?2)
             ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value",
            rusqlite::params![account_id, pm],
        )
        .map_err(db_err)?;
    }
    for (key, v) in [
        ("saldo_inicial_conta", input.saldo_inicial_conta.to_string()),
        ("saldo_inicial_reserva", input.saldo_inicial_reserva.to_string()),
        ("meta_investimento", input.meta_investimento.to_string()),
    ] {
        conn.execute(
            "INSERT INTO settings (account_id, key, value) VALUES (?1, ?2, ?3)
             ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value",
            rusqlite::params![account_id, key, v],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

/// Mês (YYYY-MM) da transação mais antiga da conta, ou mês corrente.
/// Com `primeiro_mes` configurado, o piso rígido o substitui.
pub fn earliest_month(conn: &Connection, account_id: i64) -> Result<String, String> {
    let s = get_settings_impl(conn, account_id)?;
    Ok(s.primeiro_mes.unwrap_or(earliest_tx_month(conn, account_id)?))
}

/// Mês da transação mais antiga sem considerar configurações.
pub(crate) fn earliest_tx_month(conn: &Connection, account_id: i64) -> Result<String, String> {
    let min = conn.query_row(
        "SELECT MIN(date) FROM transactions WHERE deleted_at IS NULL AND account_id = ?1",
        [account_id],
        |r| r.get::<_, Option<String>>(0),
    );
    match min {
        Ok(Some(d)) if d.len() >= 7 => Ok(d[..7].to_string()),
        _ => Ok(current_month()),
    }
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    with_db_active(&state, |c, a| get_settings_impl(c, a))
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    input: SettingsInput,
) -> Result<(), String> {
    input.validate()?;
    with_db_active(&state, |c, a| set_settings(c, a, &input))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::accounts::repository as accounts_repo;
    use crate::shared::test_db;

    fn setup() -> (Connection, i64) {
        let conn = test_db();
        let now = "2026-01-01T00:00:00Z";
        let (id, _) = accounts_repo::insert(&conn, &accounts_repo::NewAccount { name: "T", color: "#000000" }, now).unwrap();
        (conn, id)
    }

    #[test]
    fn settings_sao_escopadas_por_conta() {
        let (conn, a1) = setup();
        let (a2, _) = accounts_repo::insert(&conn, &accounts_repo::NewAccount { name: "B", color: "#111111" }, "2026-01-01T00:00:00Z").unwrap();

        let input = SettingsInput { primeiro_mes: None, saldo_inicial_conta: 500, saldo_inicial_reserva: 0, meta_investimento: 10.0 };
        set_settings(&conn, a1, &input).unwrap();

        let s1 = get_settings_impl(&conn, a1).unwrap();
        let s2 = get_settings_impl(&conn, a2).unwrap();
        assert_eq!(s1.saldo_inicial_conta, 500);
        assert_eq!(s2.saldo_inicial_conta, 0);

        assert!(SettingsInput { primeiro_mes: None, saldo_inicial_conta: -1, saldo_inicial_reserva: 0, meta_investimento: 0.0 }
            .validate().is_err());
    }
}
