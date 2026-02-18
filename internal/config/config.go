package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	BotToken     string
	WebAppURL    string
	OpenAIKey    string
	OpenAIModel  string
	DatabaseDSN  string
	AppEnv       string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		BotToken:    os.Getenv("BOT_TOKEN"),
		WebAppURL:   os.Getenv("WEBAPP_URL"),
		OpenAIKey:   os.Getenv("OPENAI_API_KEY"),
		OpenAIModel: getEnvOrDefault("OPENAI_MODEL", "gpt-4o"),
		AppEnv:      getEnvOrDefault("APP_ENV", "development"),
	}

	if cfg.BotToken == "" {
		return nil, fmt.Errorf("BOT_TOKEN is required")
	}

	cfg.DatabaseDSN = fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		getEnvOrDefault("DB_HOST", "localhost"),
		getEnvOrDefault("DB_PORT", "5432"),
		getEnvOrDefault("DB_USER", "postgres"),
		os.Getenv("DB_PASSWORD"),
		getEnvOrDefault("DB_NAME", "mak_kart_bot"),
		getEnvOrDefault("DB_SSLMODE", "disable"),
	)

	return cfg, nil
}

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
