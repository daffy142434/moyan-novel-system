mod llm;
mod db;
mod store;

use tauri::Manager;

#[tauri::command]
async fn chat_completion(
    messages: Vec<llm::ChatMessage>,
    model_id: String,
    api_key: String,
    base_url: String,
    temperature: f32,
    max_tokens: u32,
) -> Result<String, String> {
    llm::gateway::chat_completion(
        messages, model_id, api_key, base_url, temperature, max_tokens,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn chat_completion_stream(
    app_handle: tauri::AppHandle,
    messages: Vec<llm::ChatMessage>,
    model_id: String,
    api_key: String,
    base_url: String,
    temperature: f32,
    max_tokens: u32,
) -> Result<(), String> {
    llm::gateway::chat_completion_stream(
        app_handle, messages, model_id, api_key, base_url, temperature, max_tokens,
    )
    .await
    .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().unwrap_or_default();
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("local-ai-app.db");
            db::init(&db_path).map_err(|e| e.to_string())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat_completion,
            chat_completion_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
