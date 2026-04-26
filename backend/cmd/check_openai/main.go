// Однократная проверка валидности OPENAI_API_KEY.
// Запуск: из корня проекта — go run ./cmd/check_openai
package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

func main() {
	for _, path := range []string{".env", "../.env", "../../.env"} {
		_ = godotenv.Load(path)
	}

	key := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if key == "" {
		fmt.Println("OPENAI_API_KEY не задан в .env")
		os.Exit(1)
	}

	req, err := http.NewRequest(http.MethodGet, "https://api.openai.com/v1/models", nil)
	if err != nil {
		fmt.Printf("Ошибка запроса: %v\n", err)
		os.Exit(1)
	}
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("Ошибка соединения: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	switch resp.StatusCode {
	case http.StatusOK:
		fmt.Println("Ключ OPENAI_API_KEY валиден, API отвечает.")
		return
	case http.StatusUnauthorized:
		fmt.Println("Ключ невалиден или отозван (401 Unauthorized).")
		fmt.Printf("Ответ: %s\n", string(body))
		os.Exit(1)
	case http.StatusForbidden:
		fmt.Println("Ключ, вероятно, валиден, но запрос заблокирован (403).")
		fmt.Println("Частая причина: регион/страна не поддерживается OpenAI (например, нужен VPN).")
		fmt.Printf("Ответ API: %s\n", string(body))
		os.Exit(1)
	default:
		fmt.Printf("Неожиданный ответ: %d\n", resp.StatusCode)
		fmt.Printf("Тело: %s\n", string(body))
		os.Exit(1)
	}
}
