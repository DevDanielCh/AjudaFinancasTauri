use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{with_db, AppState};
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

/// Lê as configurações; ausência = defaults (None, 0, 0).
pub fn get_settings_impl(conn: &Connection) -> Result<Settings, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
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
pub fn set_settings(conn: &Connection, input: &SettingsInput) -> Result<(), String> {
    conn.execute("DELETE FROM settings WHERE key = 'primeiro_mes'", [])
        .map_err(db_err)?;
    if let Some(pm) = &input.primeiro_mes {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('primeiro_mes', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [pm],
        )
        .map_err(db_err)?;
    }
    for (key, v) in [
        ("saldo_inicial_conta", input.saldo_inicial_conta.to_string()),
        ("saldo_inicial_reserva", input.saldo_inicial_reserva.to_string()),
        ("meta_investimento", input.meta_investimento.to_string()),
    ] {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![key, v],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

/// Mês (YYYY-MM) da transação mais antiga, ou mês corrente.
/// Com `primeiro_mes` configurado, o piso rígido o substitui.
pub fn earliest_month(conn: &Connection) -> Result<String, String> {
    let s = get_settings_impl(conn)?;
    Ok(s.primeiro_mes.unwrap_or(earliest_tx_month(conn)?))
}

/// Mês da transação mais antiga sem considerar configurações.
pub(crate) fn earliest_tx_month(conn: &Connection) -> Result<String, String> {
    let min = conn.query_row("SELECT MIN(date) FROM transactions", [], |r| {
        r.get::<_, Option<String>>(0)
    });
    match min {
        Ok(Some(d)) if d.len() >= 7 => Ok(d[..7].to_string()),
        _ => Ok(current_month()),
    }
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    with_db(&state, get_settings_impl)
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    input: SettingsInput,
) -> Result<(), String> {
    input.validate()?;
    with_db(&state, |c| set_settings(c, &input))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::test_db;

    #[test]
    fn settings_roundtrip_inclui_meta_investimento() {
        let conn = test_db();
        let input = SettingsInput {
            primeiro_mes: None,
            saldo_inicial_conta: 0,
            saldo_inicial_reserva: 0,
            meta_investimento: 12.5,
        };
        assert!(input.validate().is_ok());
        set_settings(&conn, &input).unwrap();
        let s = get_settings_impl(&conn).unwrap();
        assert_eq!(s.meta_investimento, 12.5);

        let inv = SettingsInput {
            primeiro_mes: None,
            saldo_inicial_conta: 0,
            saldo_inicial_reserva: 0,
            meta_investimento: 150.0,
        };
        assert!(inv.validate().is_err(), "acima de 100 deve falhar");
    }
}
