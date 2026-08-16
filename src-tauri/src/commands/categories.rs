use crate::db::{with_db, AppState};
use crate::domain;
use crate::organizacao_financeira::models::{Category, CategoryInput};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub async fn list_categories(
    state: State<'_, AppState>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
) -> Result<Vec<Category>, String> {
    with_db(&state, |c| list(c, sort_by.as_deref(), sort_dir.as_deref()))
}

fn list(
    conn: &Connection,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<Vec<Category>, String> {
    let order = domain::order_clause(
        sort_by,
        sort_dir,
        &[("name", "name"), ("type", "type"), ("color", "color")],
        "ORDER BY name",
        "id DESC",
    );
    let mut stmt = conn
        .prepare(&format!("SELECT id, name, type, color, icon FROM categories {order}"))
        .map_err(domain::db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                type_: r.get(2)?,
                color: r.get(3)?,
                icon: r.get(4)?,
            })
        })
        .map_err(domain::db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(domain::db_err)?;
    Ok(rows)
}

fn validate(input: &CategoryInput) -> Result<(), String> {
    if input.name.trim().is_empty() {
        return Err("nome é obrigatório".into());
    }
    if input.type_ != 1 && input.type_ != 2 {
        return Err("tipo inválido".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn create_category(state: State<'_, AppState>, input: CategoryInput) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| create(c, &input))
}

pub fn create(conn: &Connection, input: &CategoryInput) -> Result<(), String> {
    let name = input.name.trim();
    let dup = conn
        .query_row(
            "SELECT 1 FROM categories WHERE name = ?1 LIMIT 1",
            params![name],
            |_| Ok(()),
        )
        .optional()
        .map_err(domain::db_err)?;
    if dup.is_some() {
        return Err("já existe categoria com esse nome".into());
    }
    conn.execute(
        "INSERT INTO categories (name, type, color, icon) VALUES (?1, ?2, ?3, ?4)",
        params![name, input.type_, input.color, input.icon],
    )
    .map_err(domain::db_err)?;
    Ok(())
}

#[tauri::command]
pub async fn update_category(
    state: State<'_, AppState>,
    id: i64,
    input: CategoryInput,
) -> Result<(), String> {
    validate(&input)?;
    with_db(&state, |c| {
        let affected = c
            .execute(
                "UPDATE categories SET name = ?1, type = ?2, color = ?3, icon = ?4 WHERE id = ?5",
                params![input.name.trim(), input.type_, input.color, input.icon, id],
            )
            .map_err(domain::db_err)?;
        if affected == 0 {
            return Err("categoria não encontrada".into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_categories(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    if ids.is_empty() {
        return Err("ids requeridos".into());
    }
    with_db(&state, |c| {
        let placeholders = vec!["?"; ids.len()].join(",");
        c.execute(
            &format!("DELETE FROM categories WHERE id IN ({placeholders})"),
            rusqlite::params_from_iter(ids.iter()),
        )
        .map_err(domain::db_err)?;
        Ok(())
    })
}
