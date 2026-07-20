use super::*;
use futures::StreamExt;
use reqwest::Client;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(120);

pub async fn chat_completion(
    messages: Vec<ChatMessage>,
    model_id: String,
    api_key: String,
    base_url: String,
    temperature: f32,
    max_tokens: u32,
) -> Result<String, Box<dyn std::error::Error>> {
    let client = Client::builder()
        .timeout(TIMEOUT)
        .build()?;

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let request = ChatCompletionRequest {
        model: model_id,
        messages,
        temperature,
        max_tokens,
        stream: false,
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error ({}): {}", status, text).into());
    }

    let data: ChatCompletionResponse = response.json().await?;
    let content = data
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();

    Ok(content)
}

pub async fn chat_completion_stream(
    app_handle: tauri::AppHandle,
    messages: Vec<ChatMessage>,
    model_id: String,
    api_key: String,
    base_url: String,
    temperature: f32,
    max_tokens: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::builder()
        .timeout(TIMEOUT)
        .build()?;

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let request = ChatCompletionRequest {
        model: model_id,
        messages,
        temperature,
        max_tokens,
        stream: true,
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(&request)
        .send()
        .await?;

    let mut stream = response.bytes_stream();
    let mut full_content = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if line.starts_with("data: ") {
                        let data = &line[6..];
                        if data == "[DONE]" {
                            break;
                        }
                        if let Ok(chunk) = serde_json::from_str::<StreamChunk>(data) {
                            if let Some(content) = chunk.choices.first()
                                .and_then(|c| c.delta.content.as_ref())
                            {
                                full_content.push_str(content);
                                // Emit event to frontend
                                app_handle.emit("stream-chunk", content.clone()).ok();
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Stream error: {}", e);
                break;
            }
        }
    }

    // Emit completion event
    app_handle.emit("stream-done", full_content).ok();

    Ok(())
}
