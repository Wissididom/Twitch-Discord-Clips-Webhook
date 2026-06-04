package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const apiBaseURL = "https://api.twitch.tv/helix"

type Token struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int       `json:"expires_in"`
	ExpiresAt    time.Time `json:"-"`
}

var (
	tokens Token
	mu     sync.Mutex
)

type User struct {
	ID              string `json:"id"`
	Login           string `json:"login"`
	DisplayName     string `json:"display_name"`
	ProfileImageURL string `json:"profile_image_url"`
}

type UserResponse struct {
	Data []User `json:"data"`
}

type Video struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type VideoResponse struct {
	Data []Video `json:"data"`
}

type Game struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	BoxArtURL string `json:"box_art_url"`
}

type GameResponse struct {
	Data []Game `json:"data"`
}

type Clip struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	URL             string  `json:"url"`
	BroadcasterID   string  `json:"broadcaster_id"`
	BroadcasterName string  `json:"broadcaster_name"`
	CreatorID       string  `json:"creator_id"`
	CreatorName     string  `json:"creator_name"`
	GameID          string  `json:"game_id"`
	Language        string  `json:"language"`
	ViewCount       int     `json:"view_count"`
	CreatedAt       string  `json:"created_at"`
	Duration        float64 `json:"duration"`
	VodOffset       int     `json:"vod_offset"`
	IsFeatured      bool    `json:"is_featured"`
	VideoID         string  `json:"video_id"`
	ThumbnailURL    string  `json:"thumbnail_url"`
}

type ClipResponse struct {
	Data []Clip `json:"data"`
}

type DiscordEmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline"`
}

type DiscordEmbed struct {
	Title     string              `json:"title"`
	URL       string              `json:"url"`
	Fields    []DiscordEmbedField `json:"fields"`
	Thumbnail *DiscordEmbedImage  `json:"thumbnail,omitempty"`
	Image     *DiscordEmbedImage  `json:"image,omitempty"`
}

type DiscordEmbedImage struct {
	URL string `json:"url"`
}

type DiscordMessage struct {
	Username  string         `json:"username"`
	AvatarURL string         `json:"avatar_url"`
	Content   string         `json:"content"`
	Embeds    []DiscordEmbed `json:"embeds"`
	ID        string         `json:"id,omitempty"`
}

type ProcessClipsResult struct {
	MessageMap map[string]DiscordMessage
	PostedIds  []string
}

func getTokens() (Token, error) {
	mu.Lock()
	defer mu.Unlock()

	if tokens.ExpiresAt.After(time.Now().Add(-1*time.Minute)) && tokens.AccessToken != "" {
		return tokens, nil
	}

	url := fmt.Sprintf(
		"https://id.twitch.tv/oauth2/token?client_id=%s&client_secret=%s&grant_type=client_credentials",
		os.Getenv("TWITCH_CLIENT_ID"),
		os.Getenv("TWITCH_CLIENT_SECRET"),
	)

	resp, err := http.Post(url, "application/json", nil)
	if err != nil {
		return Token{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return Token{}, err
	}

	if err := json.Unmarshal(body, &tokens); err != nil {
		return Token{}, err
	}

	tokens.ExpiresAt = time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)
	return tokens, nil
}

func fetchTwitch(endpoint string) ([]byte, error) {
	tokens, err := getTokens()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", apiBaseURL+endpoint, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Client-ID", os.Getenv("TWITCH_CLIENT_ID"))
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokens.AccessToken))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == 401 {
		mu.Lock()
		tokens.AccessToken = ""
		mu.Unlock()
		return fetchTwitch(endpoint)
	}

	if resp.StatusCode == 429 {
		if retryAfter := resp.Header.Get("Retry-After"); retryAfter != "" {
			if seconds, err := strconv.Atoi(retryAfter); err == nil && seconds > 0 {
				log.Printf("Rate limit hit. Retrying after %ds...", seconds)
				time.Sleep(time.Duration(seconds) * time.Second)
				return fetchTwitch(endpoint)
			}
		}
	}

	return body, nil
}

func fetchUsersByLogins(logins []string) ([]User, error) {
	if len(logins) > 100 {
		return nil, fmt.Errorf("too many users")
	}
	if len(logins) == 0 {
		return []User{}, nil
	}

	query := "?login=" + strings.Join(logins, "&login=")
	body, err := fetchTwitch("/users" + query)
	if err != nil {
		return nil, err
	}

	var response UserResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	return response.Data, nil
}

func fetchUsersByIds(ids []string) ([]User, error) {
	if len(ids) > 100 {
		return nil, fmt.Errorf("too many users")
	}
	if len(ids) == 0 {
		return []User{}, nil
	}

	query := "?id=" + strings.Join(ids, "&id=")
	body, err := fetchTwitch("/users" + query)
	if err != nil {
		return nil, err
	}

	var response UserResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	return response.Data, nil
}

func fetchVideosByIds(ids []string) ([]Video, error) {
	if len(ids) > 100 {
		return nil, fmt.Errorf("too many videos")
	}
	if len(ids) == 0 {
		return []Video{}, nil
	}

	query := "?id=" + strings.Join(ids, "&id=")
	body, err := fetchTwitch("/videos" + query)
	if err != nil {
		return nil, err
	}

	var response VideoResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	return response.Data, nil
}

func fetchGamesByIds(ids []string) ([]Game, error) {
	if len(ids) > 100 {
		return nil, fmt.Errorf("too many games")
	}
	if len(ids) == 0 {
		return []Game{}, nil
	}

	query := "?id=" + strings.Join(ids, "&id=")
	body, err := fetchTwitch("/games" + query)
	if err != nil {
		return nil, err
	}

	var response GameResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	// Process box art URLs
	for i := range response.Data {
		response.Data[i].BoxArtURL = strings.ReplaceAll(response.Data[i].BoxArtURL, "{width}", "600")
		response.Data[i].BoxArtURL = strings.ReplaceAll(response.Data[i].BoxArtURL, "{height}", "800")
	}

	return response.Data, nil
}

func fetchClips(broadcasterId string, date time.Time) ([]Clip, error) {
	endpoint := fmt.Sprintf(
		"/clips?broadcaster_id=%s&first=100&started_at=%s",
		broadcasterId,
		date.UTC().Format(time.RFC3339),
	)

	body, err := fetchTwitch(endpoint)
	if err != nil {
		return nil, err
	}

	var response ClipResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	return response.Data, nil
}

func createClipEmbed(clip Clip, games []Game) DiscordEmbed {
	var game *Game
	for i := range games {
		if games[i].ID == clip.GameID {
			game = &games[i]
			break
		}
	}

	fields := []DiscordEmbedField{
		{Name: "Game", Value: "N/A", Inline: true},
		{Name: "Streamer", Value: "N/A", Inline: true},
		{Name: "Clipper", Value: "N/A", Inline: true},
		{Name: "VOD", Value: "N/A", Inline: true},
		{Name: "Language", Value: "N/A", Inline: true},
		{Name: "Views", Value: "N/A", Inline: true},
		{Name: "Created At", Value: "N/A", Inline: true},
		{Name: "Duration", Value: "N/A", Inline: true},
		{Name: "VOD Offset", Value: "N/A", Inline: true},
		{Name: "Featured", Value: "N/A", Inline: true},
	}

	if game != nil {
		fields[0].Value = game.Name
	}
	if clip.BroadcasterName != "" {
		fields[1].Value = clip.BroadcasterName
	}
	if clip.CreatorName != "" {
		fields[2].Value = clip.CreatorName
	}
	if clip.VideoID != "" {
		fields[3].Value = fmt.Sprintf("[%s](https://www.twitch.tv/videos/%s)", clip.VideoID, clip.VideoID)
	}
	if clip.Language != "" {
		fields[4].Value = clip.Language
	}
	fields[5].Value = fmt.Sprintf("%d", clip.ViewCount)
	if clip.CreatedAt != "" {
		t, err := time.Parse(time.RFC3339, clip.CreatedAt)
		if err == nil {
			fields[6].Value = fmt.Sprintf("<t:%d:F>", t.Unix())
		}
	}
	if clip.Duration > 0 {
		fields[7].Value = fmt.Sprintf("%.0f seconds", clip.Duration)
	}
	if clip.VodOffset > 0 {
		fields[8].Value = fmt.Sprintf("%d seconds", clip.VodOffset)
	}
	fields[9].Value = fmt.Sprintf("%v", clip.IsFeatured)

	embed := DiscordEmbed{
		Title:  strings.TrimSpace(clip.Title),
		URL:    clip.URL,
		Fields: fields,
	}

	if game != nil && game.BoxArtURL != "" {
		embed.Thumbnail = &DiscordEmbedImage{URL: game.BoxArtURL}
	}

	if clip.ThumbnailURL != "" {
		embed.Image = &DiscordEmbedImage{URL: clip.ThumbnailURL}
	}

	return embed
}

func findUser(users []User, id string) *User {
	for i := range users {
		if users[i].ID == id {
			return &users[i]
		}
	}
	return nil
}

func findVideo(videos []Video, id string) *Video {
	for i := range videos {
		if videos[i].ID == id {
			return &videos[i]
		}
	}
	return nil
}

func findGame(games []Game, id string) *Game {
	for i := range games {
		if games[i].ID == id {
			return &games[i]
		}
	}
	return nil
}

func contains(slice []string, item string) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

func processClips(
	clips []Clip,
	webhookURL string,
	suppressUntitled bool,
	showCreatedDate bool,
	messageMap map[string]DiscordMessage,
	postedIds []string,
) (map[string]DiscordMessage, []string, error) {
	if len(clips) == 0 {
		return messageMap, postedIds, nil
	}

	creatorIds := make([]string, 0)
	videoIds := make([]string, 0)
	gameIds := make([]string, 0)

	seen := make(map[string]bool)
	for _, clip := range clips {
		if !seen[clip.CreatorID] {
			creatorIds = append(creatorIds, clip.CreatorID)
			seen[clip.CreatorID] = true
		}
	}

	seen = make(map[string]bool)
	for _, clip := range clips {
		if clip.VideoID != "" && !seen[clip.VideoID] {
			videoIds = append(videoIds, clip.VideoID)
			seen[clip.VideoID] = true
		}
	}

	seen = make(map[string]bool)
	for _, clip := range clips {
		if clip.GameID != "" && !seen[clip.GameID] {
			gameIds = append(gameIds, clip.GameID)
			seen[clip.GameID] = true
		}
	}

	users, _ := fetchUsersByIds(creatorIds)
	videos, _ := fetchVideosByIds(videoIds)
	games, _ := fetchGamesByIds(gameIds)

	for _, clip := range clips {
		if suppressUntitled {
			video := findVideo(videos, clip.VideoID)
			if video != nil && video.Title == clip.Title {
				continue
			}
		}

		content := fmt.Sprintf("``%s``: %s", strings.TrimSpace(clip.Title), clip.URL)
		if showCreatedDate {
			t, err := time.Parse(time.RFC3339, clip.CreatedAt)
			if err == nil {
				timestamp := t.Unix()
				content += fmt.Sprintf(" (Created at: <t:%d:F> - <t:%d:R>)", timestamp, timestamp)
			}
		}

		if contains(postedIds, clip.ID) {
			existing, ok := messageMap[clip.ID]
			if !ok {
				continue
			}

			anythingChanged := existing.Content != content
			if anythingChanged || len(existing.Embeds) == 0 {
				editPayload := DiscordMessage{
					Content: content,
				}

				if len(existing.Embeds) > 0 {
					embed := existing.Embeds[0]
					if len(embed.Fields) > 0 {
						for i := range embed.Fields {
							if embed.Fields[i].Name == "Game" {
								if game := findGame(games, clip.GameID); game != nil {
									embed.Fields[i].Value = game.Name
								}
							} else if embed.Fields[i].Name == "Streamer" {
								embed.Fields[i].Value = clip.BroadcasterName
							} else if embed.Fields[i].Name == "Clipper" {
								embed.Fields[i].Value = clip.CreatorName
							}
						}
						editPayload.Embeds = []DiscordEmbed{embed}
					}
				}

				reqBody, _ := json.Marshal(editPayload)
				patchReq, _ := http.NewRequest("PATCH", fmt.Sprintf("%s/messages/%s", webhookURL, existing.ID), bytes.NewReader(reqBody))
				patchReq.Header.Set("Content-Type", "application/json")

				patchResp, err := http.DefaultClient.Do(patchReq)
				if err == nil {
					patchResp.Body.Close()
				}
			}
			continue
		}

		user := findUser(users, clip.CreatorID)
		avatarURL := ""
		if user != nil {
			avatarURL = user.ProfileImageURL
		}

		embed := createClipEmbed(clip, games)

		message := DiscordMessage{
			Username:  clip.CreatorName,
			AvatarURL: avatarURL,
			Content:   content,
			Embeds:    []DiscordEmbed{embed},
		}

		msgBody, _ := json.Marshal(message)
		postResp, err := http.Post(
			fmt.Sprintf("%s?wait=true", webhookURL),
			"application/json",
			bytes.NewReader(msgBody),
		)
		if err != nil {
			continue
		}

		if postResp.StatusCode == 200 {
			respBody, _ := io.ReadAll(postResp.Body)
			var respMessage DiscordMessage
			if err := json.Unmarshal(respBody, &respMessage); err == nil {
				postedIds = append(postedIds, clip.ID)
				messageMap[clip.ID] = respMessage
			}
		}
		postResp.Body.Close()
	}

	return messageMap, postedIds, nil
}

func handleStreamer(
	broadcasterLogin string,
	webhookURL string,
	pollingInterval string,
	suppressUntitled bool,
	showCreatedDate bool,
	useService bool,
) error {
	broadcasters, err := fetchUsersByLogins([]string{broadcasterLogin})
	if err != nil {
		return fmt.Errorf("error retrieving broadcaster info: %v", err)
	}

	if len(broadcasters) < 1 {
		log.Printf("Broadcaster %s not found!", broadcasterLogin)
		return nil
	}

	broadcasterId := broadcasters[0].ID
	broadcasterDisplayName := broadcasters[0].DisplayName

	if useService {
		messageMap := make(map[string]DiscordMessage)
		postedIds := make([]string, 0)

		log.Printf("Creating ticker for %s (%s) - Clips should now be checked every 5 minutes",
			broadcasterDisplayName, broadcasterLogin)

		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			date := time.Now().Add(-5 * time.Minute)
			clips, err := fetchClips(broadcasterId, date)
			if err != nil {
				log.Printf("Error fetching clips: %v", err)
				continue
			}

			clipsJSON, _ := json.MarshalIndent(clips, "", "  ")
			log.Printf("%s - %s (%s) - %s",
				time.Now().Format(time.RFC3339),
				broadcasterDisplayName,
				broadcasterLogin,
				string(clipsJSON))

			var procErr error
			messageMap, postedIds, procErr = processClips(
				clips,
				webhookURL,
				suppressUntitled,
				showCreatedDate,
				messageMap,
				postedIds,
			)
			if procErr != nil {
				log.Printf("Error processing clips: %v", procErr)
			}
		}
	} else {
		// Parse polling interval
		if len(pollingInterval) < 2 {
			return fmt.Errorf("invalid polling interval: %s", pollingInterval)
		}

		numStr := pollingInterval[:len(pollingInterval)-1]
		unit := pollingInterval[len(pollingInterval)-1]

		num, err := strconv.Atoi(numStr)
		if err != nil {
			return fmt.Errorf("invalid polling interval number: %v", err)
		}

		date := time.Now()
		switch unit {
		case 'd':
			date = date.AddDate(0, 0, -num)
		case 'M':
			date = date.AddDate(0, -num, 0)
		case 'y':
			date = date.AddDate(-num, 0, 0)
		case 'h':
			date = date.Add(-time.Duration(num) * time.Hour)
		case 'm':
			date = date.Add(-time.Duration(num) * time.Minute)
		case 's':
			date = date.Add(-time.Duration(num) * time.Second)
		default:
			return fmt.Errorf("invalid polling interval unit: %c (use d, M, y, h, m, or s)", unit)
		}

		clips, err := fetchClips(broadcasterId, date)
		if err != nil {
			return fmt.Errorf("error fetching clips: %v", err)
		}

		clipsJSON, _ := json.MarshalIndent(clips, "", "  ")
		log.Printf("%s - %s (%s) - %s",
			time.Now().Format(time.RFC3339),
			broadcasterDisplayName,
			broadcasterLogin,
			string(clipsJSON))

		_, _, err = processClips(
			clips,
			webhookURL,
			suppressUntitled,
			showCreatedDate,
			make(map[string]DiscordMessage),
			make([]string, 0),
		)
		return err
	}

	return nil
}
