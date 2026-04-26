package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
)

const (
	// DefaultURL — базовый endpoint для Chat Completions OpenAI.
	DefaultURL = "https://api.openai.com/v1/chat/completions"
	// DefaultModel — модель по умолчанию, которую используем в боте.
	// Используем полнофункциональную GPT‑4o (поддерживает текст и изображения).
	DefaultModel = "gpt-4o"
)

// Message описывает одно сообщение диалога для Chat Completions.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Request — минимальный запрос к Chat Completions, который нам нужен.
type Request struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

// Choice — один вариант ответа модели.
type Choice struct {
	Message Message `json:"message"`
}

// Response — минимально необходимая часть ответа Chat Completions.
type Response struct {
	Choices []Choice `json:"choices"`
}

// UserError — универсальная "человеко-понятная" ошибка для показа пользователю.
// Технические детали логируются внутри пакета openai.
type UserError struct {
	Text string
}

func (e *UserError) Error() string {
	return e.Text
}

// ChatCompletion выполняет запрос к OpenAI Chat Completions
// и централизованно обрабатывает все сетевые/JSON/HTTP-ошибки.
// В случае проблемы возвращает UserError с текстом для пользователя.
func ChatCompletion(ctx context.Context, apiKey string, req Request) (Response, *UserError) {
	var empty Response

	body, err := json.Marshal(req)
	if err != nil {
		log.Printf("openai: marshal request: %v", err)
		return empty, &UserError{
			Text: "Сейчас ИИ временно недоступен. Попробуйте позже.",
		}
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, DefaultURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("openai: new request: %v", err)
		return empty, &UserError{
			Text: "Сейчас ИИ временно недоступен. Попробуйте позже.",
		}
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		log.Printf("openai: do request: %v", err)
		return empty, &UserError{
			Text: "Сейчас не удалось связаться с ИИ. Попробуйте ещё раз чуть позже.",
		}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("openai: status %d: %s", resp.StatusCode, string(respBody))
		return empty, &UserError{
			Text: "ИИ временно недоступен. Попробуйте позже.",
		}
	}

	var out Response
	if err := json.Unmarshal(respBody, &out); err != nil {
		log.Printf("openai: unmarshal response: %v", err)
		return empty, &UserError{
			Text: "Не получилось разобрать ответ ИИ. Попробуйте сформулировать запрос ещё раз.",
		}
	}

	return out, nil
}

// ChatCompletionWithImage отправляет в модель текст и одно изображение по URL
// (подходит в том числе для URL файлов Telegram). Используется для расшифровки карт.
func ChatCompletionWithImage(ctx context.Context, apiKey, prompt, imageURL string) (Response, *UserError) {
	var empty Response

	payload := map[string]interface{}{
		"model": DefaultModel,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type": "image_url",
						"image_url": map[string]interface{}{
							"url": imageURL,
						},
					},
				},
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("openai: marshal vision request: %v", err)
		return empty, &UserError{
			Text: "Сейчас ИИ временно недоступен. Попробуйте позже.",
		}
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, DefaultURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("openai: new vision request: %v", err)
		return empty, &UserError{
			Text: "Сейчас ИИ временно недоступен. Попробуйте позже.",
		}
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		log.Printf("openai: do vision request: %v", err)
		return empty, &UserError{
			Text: "Сейчас не удалось связаться с ИИ. Попробуйте ещё раз чуть позже.",
		}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("openai: vision status %d: %s", resp.StatusCode, string(respBody))
		return empty, &UserError{
			Text: "ИИ временно недоступен. Попробуйте позже.",
		}
	}

	var out Response
	if err := json.Unmarshal(respBody, &out); err != nil {
		log.Printf("openai: unmarshal vision response: %v", err)
		return empty, &UserError{
			Text: "Не получилось разобрать ответ ИИ. Попробуйте ещё раз.",
		}
	}

	return out, nil
}

