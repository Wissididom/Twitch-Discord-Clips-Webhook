import { WebhookClient, EmbedBuilder } from "discord.js";

const API_BASE_URL = "https://api.twitch.tv/helix";

let tokens = {
  access_token: null,
  refresh_token: null,
  expires_in: null,
  expires_at: null,
};

async function getTokens() {
  const bufferMs = 60 * 1000; // 1 minute buffer
  const isValid =
    tokens.expires_at &&
    new Date().getTime() < tokens.expires_at.getTime() - bufferMs;
  if (isValid) {
    return tokens;
  }
  tokens = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    {
      method: "POST",
    },
  ).then(async (res) => {
    let result = await res.json();
    result.expires_at = new Date(Date.now() + result.expires_in * 1000);
    return result;
  });
  return tokens;
}

async function fetchTwitch(endpoint, tokens) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });
  return res.json();
}

async function fetchUsersByLogins(tokens, logins) {
  if (logins.length > 100) throw new Error("Too many users");
  if (logins.length < 1) return [];
  const query = `?login=${logins.join("&login=")}`;
  const data = await fetchTwitch(`/users${query}`, tokens);
  return data.data.map(({ id, login, display_name }) => ({
    id,
    login,
    display_name,
  }));
}

async function fetchUsersByIds(tokens, ids) {
  if (ids.length > 100) throw new Error("Too many users");
  if (ids.length < 1) return [];
  const query = `?id=${ids.join("&id=")}`;
  const data = await fetchTwitch(`/users${query}`, tokens);
  return data.data.map(({ id, login, display_name }) => ({
    id,
    login,
    display_name,
  }));
}

async function fetchVideosByIds(tokens, ids) {
  if (ids.length > 100) throw new Error("Too many videos");
  if (ids.length < 1) return [];
  const query = `?id=${ids.join("&id=")}`;
  const data = await fetchTwitch(`/videos${query}`, tokens);
  return data.data.map(({ id, title }) => ({ id, title }));
}

async function fetchGamesByIds(tokens, ids) {
  if (ids.length > 100) throw new Error("Too many games");
  if (ids.length < 1) return [];
  const query = `?id=${ids.join("&id=")}`;
  const data = await fetchTwitch(`/games${query}`, tokens);
  return data.data.map(({ id, name, box_art_url }) => ({
    id,
    name,
    boxart: box_art_url.replace("{width}", "600").replace("{height}", "800"),
  }));
}

async function fetchClips(tokens, broadcasterId, date) {
  const data = await fetchTwitch(
    `/clips?broadcaster_id=${broadcasterId}&first=100&started_at=${date.toISOString()}`,
    tokens,
  );
  return data.data;
}

function createClipEmbed(clip, gameNames, videoTitles) {
  const game = gameNames.find((x) => x.id === clip.game_id);
  const video = videoTitles.find((x) => x.id === clip.videos_id);

  return new EmbedBuilder()
    .setTitle(clip.title.trim())
    .setURL(clip.url)
    .addFields(
      { name: "Game", value: game?.name ?? "N/A", inline: true },
      { name: "Streamer", value: clip.broadcaster_name ?? "N/A", inline: true },
      { name: "Clipper", value: clip.creator_name ?? "N/A", inline: true },
      {
        name: "VOD",
        value: clip.video_id
          ? `[${clip.video_id}](https://www.twitch.tv/videos/${clip.video_id})`
          : "N/A",
        inline: true,
      },
      { name: "Language", value: clip.language ?? "N/A", inline: true },
      {
        name: "Views",
        value: clip.view_count?.toString() ?? "N/A",
        inline: true,
      },
      {
        name: "Created At",
        value: clip.created_at
          ? `<t:${Math.floor(new Date(clip.created_at).getTime() / 1000)}:F>`
          : "N/A",
        inline: true,
      },
      {
        name: "Duration",
        value: `${clip.duration} seconds` ?? "N/A",
        inline: true,
      },
      {
        name: "VOD Offset",
        value: clip.vod_offset ? `${clip.vod_offset} seconds` : "N/A",
        inline: true,
      },
      {
        name: "Featured",
        value:
          typeof clip.is_featured === "boolean"
            ? clip.is_featured.toString()
            : "N/A",
        inline: true,
      },
    )
    .setThumbnail(game?.boxart)
    .setImage(clip.thumbnail_url);
}

async function processClips(
  tokens,
  clips,
  webhookClient,
  options,
  messageMap = {},
  postedIds = [],
) {
  if (clips.length === 0) return { messageMap, postedIds }; // No clips to post
  const { suppressUntitled, showCreatedDate } = options;
  const creatorIds = [...new Set(clips.map((c) => c.creator_id))]; // Make sure there are no duplicate entries
  const videoIds = [...new Set(clips.map((c) => c.video_id).filter(Boolean))]; // Make sure there are no duplicate entries
  const gameIds = [...new Set(clips.map((c) => c.game_id).filter(Boolean))]; // Make sure there are no duplicate entries
  const [users, videos, games] = await Promise.all([
    fetchUsersByIds(tokens, creatorIds),
    fetchVideosByIds(tokens, videoIds),
    fetchGamesByIds(tokens, gameIds),
  ]);
  for (const clip of clips) {
    if (suppressUntitled) {
      const video = videos.find((v) => v.id === clip.video_id);
      if (video && video.title === clip.title) continue;
    }
    let content = `\`\`${clip.title.trim()}\`\`: ${clip.url}`;
    if (showCreatedDate) {
      const time = Math.floor(new Date(clip.created_at).getTime() / 1000);
      content += ` (Created at: <t:${time}:F> - <t:${time}:R>)`;
    }
    if (postedIds.includes(clip.id)) {
      // Don't post clips that were already posted. Edit them, because the Clip will get returned even if no title was set yet.
      const existing = messageMap[clip.id];
      if (existing?.content !== content) {
        const edited = await webhookClient.editMessage(existing.id, {
          content,
        });
        messageMap[clip.id] = edited;
      }
      continue;
    }
    const msg = await webhookClient.send({
      username: clip.creator_name,
      avatarURL: users.find((u) => u.id === clip.creator_id)?.profileImageUrl,
      content,
      embeds: [createClipEmbed(clip, games, videos)],
    });
    postedIds.push(clip.id);
    messageMap[clip.id] = msg;
  }
  return { messageMap, postedIds };
}

export async function handleStreamer(
  broadcasterLogin,
  webhookUrl,
  pollingInterval,
  suppressUntitled,
  showCreatedDate,
  useService = false,
) {
  const tokens = await getTokens();
  const webhookClient = new WebhookClient({ url: webhookUrl });
  const broadcaster = await fetchUsersByLogins(tokens, [broadcasterLogin]);
  if (!broadcaster) {
    console.error(
      `Error retrieving broadcaster info. Response from Twitch: ${JSON.stringify(
        broadcaster,
      )}`,
    );
    return;
  }
  if (broadcaster.length < 1) {
    console.log(`Broadcaster ${broadcasterLogin} not found!`);
    return;
  }
  const broadcasterId = broadcaster[0].id;
  const broadcasterDisplayName = broadcaster[0].display_name;
  if (useService) {
    let messageMap = {};
    let postedIds = [];
    console.log(
      `Running setInterval for ${broadcasterDisplayName} (${broadcasterLogin}) - Clips should now be checked every 5 minutes`,
    );
    setInterval(async () => {
      try {
        const tokens = await getTokens();
        if (tokens.expires_at < new Date()) token = await getTokens();
        let date = new Date(Math.floor(Date.now() / 1000) * 1000 - 5 * 60000);
        let clips = await fetchClips(tokens, broadcasterId, date);
        console.log(
          `${new Date().toISOString()} - ${broadcasterDisplayName} (${broadcasterLogin}) - ${JSON.stringify(clips, null, 2)}`,
        );
        ({ messageMap, postedIds } = await processClips(
          tokens,
          clips,
          webhookClient,
          {
            suppressUntitled,
            showCreatedDate,
          },
          messageMap,
          postedIds,
        ));
      } catch (err) {
        // console.log(err.stack); // Don't exit on unhandled errors! Just print trace!
        console.trace(err); // Don't exit on unhandled errors! Just print trace!
      }
    }, 5 * 60000);
  } else {
    const pollingIntervalNumber = parseInt(
      pollingInterval.substring(0, pollingInterval.length - 1),
    );
    let date = new Date();
    switch (pollingInterval.substring(pollingInterval.length - 1)) {
      case "d":
        date.setDate(date.getDate() - pollingIntervalNumber);
        break;
      case "M":
        date.setMonth(date.getMonth() - pollingIntervalNumber);
        break;
      case "y":
        date.setFullYear(date.getFullYear() - pollingIntervalNumber);
        break;
      case "h":
        date.setHours(date.getHours() - pollingIntervalNumber);
        break;
      case "m":
        date.setMinutes(date.getMinutes() - pollingIntervalNumber);
        break;
      case "s":
        date.setSeconds(date.getSeconds() - pollingIntervalNumber);
        break;
      default:
        console.error(
          `Only d (days), M (months), y (years), h (hours), m (minutes) and s (seconds) are allowed! You used ${pollingInterval.substring(
            pollingInterval.length - 1,
          )}`,
        );
        return;
    }
    const tokens = await getTokens();
    const clips = await fetchClips(tokens, broadcasterId, date);
    console.log(
      `${new Date().toISOString()} - ${broadcasterDisplayName} (${broadcasterLogin}) - ${JSON.stringify(clips, null, 2)}`,
    );
    await processClips(tokens, clips, webhookClient, {
      suppressUntitled,
      showCreatedDate,
    });
  }
}
