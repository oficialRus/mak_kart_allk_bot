package telegramapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// SendMessage отправляет текст пользователю в личку. chatID = telegram user id.
// Пользователь должен хотя бы раз нажать /start у бота, иначе будет ошибка.
func SendMessage(ctx context.Context, botToken, text string, chatID int64) error {
	if botToken == "" {
		return fmt.Errorf("empty bot token")
	}
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var apiResp struct {
		Ok          bool   `json:"ok"`
		Description string `json:"description"`
	}
	_ = json.Unmarshal(body, &apiResp)
	if !apiResp.Ok {
		if apiResp.Description != "" {
			return fmt.Errorf("telegram: %s", apiResp.Description)
		}
		return fmt.Errorf("telegram: http %d: %s", resp.StatusCode, string(body))
	}
	return nil
}
