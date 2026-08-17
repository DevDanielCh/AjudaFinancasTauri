use crate::db::AppState;
use tauri::webview::PageLoadEvent;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_log::{Target, TargetKind};

pub mod commands;
pub mod db;
pub mod domain;
pub mod investimentos;
pub mod organizacao_financeira;
pub mod shared;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

fn external_navigation_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::<R>::new("external-navigation")
        .on_navigation(|webview, url| {
            let is_internal_host = matches!(
                url.host_str(),
                Some("localhost") | Some("127.0.0.1") | Some("tauri.localhost") | Some("::1")
            );

            let is_internal = url.scheme() == "tauri" || is_internal_host;

            if is_internal {
                return true;
            }

            let is_external_link = matches!(url.scheme(), "http" | "https" | "mailto" | "tel");

            if is_external_link {
                log::info!("opening external link in system browser: {}", url);
                let _ = webview.opener().open_url(url.as_str(), None::<&str>);
                return false;
            }

            true
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(external_navigation_plugin())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let conn = db::open(app.handle()).expect("falha ao abrir o banco de dados");
            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            shared::util::get_earliest_month,
            shared::util::get_version,
            shared::report::get_dashboard,
            shared::report::sync_dashboard,
            shared::report::get_chart_data,
            commands::transactions::list_transactions,
            commands::transactions::list_reserva_movements,
            commands::transactions::create_transaction,
            commands::transactions::update_transaction,
            commands::transactions::delete_transactions,
            commands::transactions::get_card_bill,
            organizacao_financeira::controller::list_categories,
            organizacao_financeira::controller::create_category,
            organizacao_financeira::controller::update_category,
            organizacao_financeira::controller::delete_categories,
            organizacao_financeira::controller::list_payment_methods,
            organizacao_financeira::controller::create_payment_method,
            organizacao_financeira::controller::update_payment_method,
            organizacao_financeira::controller::delete_payment_methods,
            commands::fixed_bills::list_fixed_bills,
            commands::fixed_bills::create_fixed_bill,
            commands::fixed_bills::update_fixed_bill,
            commands::fixed_bills::delete_fixed_bills,
            commands::loans::list_loans,
            commands::loans::get_loan_detail,
            commands::loans::create_loan,
            commands::loans::update_loan,
            commands::loans::delete_loans,
            shared::settings::get_settings,
            shared::settings::update_settings,
        ])
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && matches!(payload.event(), PageLoadEvent::Finished) {
                log::info!("main webview finished loading");
                let _ = webview.window().show();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
