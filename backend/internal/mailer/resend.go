package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ResendSender — транзакционная почта через HTTPS API (обычно лучше доходит до mail.ru / Gmail, чем свой VPS + SMTP).
type ResendSender struct {
	apiKey string
	from   string
	client *http.Client
}

func NewResend(apiKey, from string) (*ResendSender, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("resend: empty API key")
	}
	if from == "" {
		return nil, fmt.Errorf("resend: empty from")
	}
	return &ResendSender{
		apiKey: apiKey,
		from:   from,
		client: &http.Client{Timeout: 25 * time.Second},
	}, nil
}

func (r *ResendSender) Send(ctx context.Context, to []string, msg EmailMessage) error {
	if len(to) == 0 {
		return fmt.Errorf("no recipients")
	}
	payload := map[string]interface{}{
		"from":    r.from,
		"to":      to,
		"subject": msg.Subject,
		"text":    msg.Text,
	}
	if strings.TrimSpace(msg.HTML) != "" {
		payload["html"] = msg.HTML
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+r.apiKey)

	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("resend http: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	var parsed struct {
		Message string `json:"message"`
	}
	_ = json.Unmarshal(respBody, &parsed)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if parsed.Message != "" {
			return fmt.Errorf("resend: %s (http %d)", parsed.Message, resp.StatusCode)
		}
		return fmt.Errorf("resend: http %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}
