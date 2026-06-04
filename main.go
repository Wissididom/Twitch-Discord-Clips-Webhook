package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

type StreamerConfig struct {
	TwitchLogin      string  `json:"twitchLogin"`
	Cron             *string `json:"cron"`
	Timezone         *string `json:"timezone"`
	DiscordWebhook   string  `json:"discordWebhook"`
	PollingInterval  *string `json:"pollingInterval"`
	SuppressUntitled *bool   `json:"suppressUntitled"`
	ShowCreatedDate  *bool   `json:"showCreatedDate"`
}

func main() {
	godotenv.Load()

	configFile, err := os.Open(".config.json")
	if err != nil {
		log.Fatalf("Error opening config file: %v", err)
	}
	defer configFile.Close()

	configBytes, err := io.ReadAll(configFile)
	if err != nil {
		log.Fatalf("Error reading config file: %v", err)
	}

	var config []StreamerConfig
	if err := json.Unmarshal(configBytes, &config); err != nil {
		log.Fatalf("Error parsing config: %v", err)
	}

	c := cron.New(
		cron.WithSeconds(),
	)

	for _, streamer := range config {
		// Set defaults
		pollingInterval := "1d"
		if streamer.PollingInterval != nil {
			pollingInterval = *streamer.PollingInterval
		}

		suppressUntitled := false
		if streamer.SuppressUntitled != nil {
			suppressUntitled = *streamer.SuppressUntitled
		}

		showCreatedDate := true
		if streamer.ShowCreatedDate != nil {
			showCreatedDate = *streamer.ShowCreatedDate
		}

		// Log the scheduled job
		logConfig := streamer
		logConfig.DiscordWebhook = "REDACTED"
		logBytes, _ := json.Marshal(logConfig)
		fmt.Printf("Schedule job: %s\n", string(logBytes))

		if streamer.Cron != nil && *streamer.Cron != "" {
			cronExpr := *streamer.Cron
			_, err := c.AddFunc(cronExpr, func() {
				if err := handleStreamer(
					streamer.TwitchLogin,
					streamer.DiscordWebhook,
					pollingInterval,
					suppressUntitled,
					showCreatedDate,
					false,
				); err != nil {
					log.Printf("Error handling streamer: %v", err)
				}
			})
			if err != nil {
				log.Printf("Error adding cron job: %v", err)
			}
		} else {
			if err := handleStreamer(
				streamer.TwitchLogin,
				streamer.DiscordWebhook,
				pollingInterval,
				suppressUntitled,
				showCreatedDate,
				true,
			); err != nil {
				log.Printf("Error handling streamer: %v", err)
			}
		}
	}

	c.Start()
	select {}
}
