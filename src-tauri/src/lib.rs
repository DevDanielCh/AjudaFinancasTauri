use crate::db::AppState;
use crate::sync::controller::SyncState;
use tauri::webview::PageLoadEvent;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_log::{Target, TargetKind};

pub mod db;
pub mod google;
pub mod investimentos;
pub mod organizacao_financeira;
pub mod shared;
pub mod sync;

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

fn google_credentials() -> (String, String) {
    let id = option_env!("GOOGLE_CLIENT_ID")
        .map(String::from)
        .or_else(|| {
            let _ = dotenvy::dotenv();
            std::env::var("GOOGLE_CLIENT_ID").ok()
        })
        .expect("GOOGLE_CLIENT_ID not set");

    let secret = option_env!("GOOGLE_CLIENT_SECRET")
        .map(String::from)
        .or_else(|| {
            std::env::var("GOOGLE_CLIENT_SECRET").ok()
        })
        .expect("GOOGLE_CLIENT_SECRET not set");

    (id, secret)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (client_id, client_secret) = google_credentials();

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
        .setup(move |app| {
            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_safe_area_insets::init())?;

            let conn = db::open(app.handle()).expect("falha ao abrir o banco de dados");
            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
            });
            app.manage(SyncState {
                client_id: client_id.clone(),
                client_secret: client_secret.clone(),
                pending_auth: std::sync::Mutex::new(None),
                syncing: std::sync::atomic::AtomicBool::new(false),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            shared::util::get_earliest_month,
            shared::util::get_version,
            shared::report::get_dashboard,
            shared::report::sync_dashboard,
            shared::report::get_chart_data,
            organizacao_financeira::controller::list_transactions,
            investimentos::controller::list_reserva_movements,
            organizacao_financeira::controller::create_transaction,
            organizacao_financeira::controller::update_transaction,
            organizacao_financeira::controller::delete_transactions,
            organizacao_financeira::controller::get_card_bill,
            organizacao_financeira::controller::list_categories,
            organizacao_financeira::controller::create_category,
            organizacao_financeira::controller::update_category,
            organizacao_financeira::controller::delete_categories,
            organizacao_financeira::controller::list_payment_methods,
            organizacao_financeira::controller::create_payment_method,
            organizacao_financeira::controller::update_payment_method,
            organizacao_financeira::controller::delete_payment_methods,
            organizacao_financeira::controller::list_fixed_bills,
            organizacao_financeira::controller::create_fixed_bill,
            organizacao_financeira::controller::update_fixed_bill,
            organizacao_financeira::controller::delete_fixed_bills,
            organizacao_financeira::controller::list_loans,
            organizacao_financeira::controller::get_loan_detail,
            organizacao_financeira::controller::create_loan,
            organizacao_financeira::controller::update_loan,
            organizacao_financeira::controller::delete_loans,
            shared::settings::get_settings,
            shared::settings::update_settings,
            sync::controller::sync_connect_google,
            sync::controller::sync_start_auth,
            sync::controller::sync_complete_auth,
            sync::controller::sync_open_url,
            sync::controller::sync_disconnect,
            sync::controller::sync_status,
            sync::controller::sync_now,
            sync::controller::sync_auto,
            sync::controller::sync_is_connected,
            sync::controller::sync_set_passphrase,
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
