pub mod database;
pub mod commands;
pub mod integrations;

use database::DbState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database
            let db = database::init_database(app.handle())
                .expect("failed to initialize database");
            
            app.manage(DbState {
                conn: Mutex::new(db),
            });

            app.manage(commands::OllamaProcessState {
                child: Mutex::new(None),
            });

            app.manage(integrations::create_service(app.handle()));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_task,
            commands::get_all_tasks,
            commands::get_tasks_by_date,
            commands::update_task,
            commands::complete_task,
            commands::uncomplete_task,
            commands::delete_task,
            commands::duplicate_task,
            commands::create_goal,
            commands::get_all_goals,
            commands::update_goal,
            commands::delete_goal,
            commands::create_project,
            commands::get_all_projects,
            commands::update_project,
            commands::delete_project,
            commands::create_category,
            commands::get_all_categories,
            commands::update_category,
            commands::delete_category,
            commands::create_meeting,
            commands::get_all_meetings,
            commands::get_meetings_by_date,
            commands::update_meeting,
            commands::delete_meeting,
            commands::search,
            commands::get_task_stats,
            commands::get_tasks_for_date_range,
            commands::get_meetings_for_date_range,
            commands::get_setting,
            commands::set_setting,
            commands::create_routine,
            commands::get_all_routines,
            commands::update_routine,
            commands::delete_routine,
            commands::create_routine_task,
            commands::get_routine_tasks,
            commands::get_all_routine_tasks,
            commands::update_routine_task,
            commands::delete_routine_task,
            commands::create_planner_entry,
            commands::get_planner_entries,
            commands::update_planner_entry,
            commands::delete_planner_entry,
            commands::create_planner_template,
            commands::get_planner_templates,
            commands::delete_planner_template,
            commands::create_day_template,
            commands::get_day_templates,
            commands::delete_day_template,
            commands::create_note_folder,
            commands::get_all_note_folders,
            commands::update_note_folder,
            commands::delete_note_folder,
            commands::create_note,
            commands::get_all_notes,
            commands::get_notes_by_folder,
            commands::update_note,
            commands::delete_note,
            commands::start_ollama,
            commands::stop_ollama,
            commands::ollama_pull_model,
            commands::get_model_storage_paths,
            commands::get_system_specs,
            commands::open_directory,
            commands::pick_folder,
            commands::tts_speak_local,
            commands::tts_download_model,
            commands::tts_check_model,
            commands::tts_list_downloaded,
            commands::integration_get_statuses,
            commands::integration_connect,
            commands::integration_disconnect,
            commands::integration_sync_google_calendar,
            commands::integration_create_meeting,
            commands::integration_get_meeting,
            commands::integration_update_meeting,
            commands::integration_delete_meeting,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<commands::OllamaProcessState>() {
                    let _ = commands::stop_ollama(state);
                }
            }
        });
}
