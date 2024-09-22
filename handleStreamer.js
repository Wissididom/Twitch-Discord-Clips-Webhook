import { WebhookClient, EmbedBuilder } from "discord.js";

export async function handleStreamer(
  broadcasterLogin,
  webhookUrl,
  pollingInterval,
  suppressUntitled,
  showCreatedDate,
) {
  const tokens = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    {
      method: "POST",
    },
  ).then((res) => res.json());
  const broadcaster = await fetch(
    `https://api.twitch.tv/helix/users?login=${broadcasterLogin}`,
    {
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${tokens.access_token}`,
      },
    },
  ).then((res) => res.json());
  if (!broadcaster.data) {
    console.error(
      `Error retrieving broadcaster info. Response from Twitch: ${JSON.stringify(
        broadcaster,
      )}`,
    );
    //process.exit(77); // EX_NOPERM
    process.exit(78); // EX_CONFIG
  }
  const broadcasterId = broadcaster.data[0].id;
  const broadcasterDisplayName = broadcaster.data[0].display_name;
  const pollingIntervalNumber = parseInt(
    pollingInterval.substring(0, pollingInterval.length - 1),
  );
  let date = new Date();
  switch (pollingInterval.substring(pollingInterval.length - 1)) {
    case "d": // days
      date.setDate(date.getDate() - pollingIntervalNumber);
      break;
    case "M": // months
      date.setMonth(date.getMonth() - pollingIntervalNumber);
      break;
    case "y": // years
      date.setFullYear(date.getFullYear() - pollingIntervalNumber);
      break;
    case "h": // hours
      date.setHours(date.getHours() - pollingIntervalNumber);
      break;
    case "m": // minutes
      date.setMinutes(date.getMinutes() - pollingIntervalNumber);
      break;
    case "s": // seconds
      date.setSeconds(date.getSeconds() - pollingIntervalNumber);
      break;
    default: // else
      console.error(
        `Only d (days), M (months), y (years), h (hours), m (minutes) and s (seconds) are allowed! You used ${pollingInterval.substring(
          pollingInterval.length - 1,
        )}`,
      );
      process.exit(78); // EX_CONFIG
      break;
  }
  const clips = (
    await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=100&started_at=${date.toISOString()}`,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      },
    ).then((res) => res.json())
  ).data;
  console.log(
    `${broadcasterDisplayName} (${broadcasterLogin}): ${JSON.stringify(clips, null, 2)}`,
  );
  let creatorIds = [];
  let videoIds = [];
  let gameIds = [];
  if (clips.length < 1) return; // No clips to post
  for (let i = 0; i < clips.length; i++) {
    creatorIds.push(clips[i].creator_id);
    if (clips[i].video_id.length > 0) {
      videoIds.push(clips[i].video_id);
    }
    if (clips[i].game_id.length > 0) {
      gameIds.push(clips[i].game_id);
    }
  }
  creatorIds = [...new Set(creatorIds)]; // Remove duplicate entries
  videoIds = [...new Set(videoIds)]; // Remove duplicate entries
  gameIds = [...new Set(gameIds)]; // Remove duplicate entries
  let usersQuery;
  let profileImageUrls = [];
  if (creatorIds.length > 0 && creatorIds.length <= 100) {
    usersQuery = "?id=" + creatorIds.join("&id=");
    profileImageUrls = (
      await fetch(`https://api.twitch.tv/helix/users${usersQuery}`, {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }).then((res) => res.json())
    ).data.map((x) => {
      return {
        id: x.id,
        profileImageUrl: x.profile_image_url,
      };
    });
  } else if (creatorIds.length > 100) {
    console.error("More than 100 users to look up");
  }
  let videosQuery;
  let videoTitles = [];
  if (videoIds.length > 0 && videoIds.length <= 100) {
    videosQuery = "?id=" + videoIds.join("&id=");
    videoTitles = (
      await fetch(`https://api.twitch.tv/helix/videos${videosQuery}`, {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })
        .then((res) => res.json())
        .catch((err) => console.error(err))
    ).data.map((x) => {
      return {
        id: x.id,
        title: x.title,
      };
    });
  } else if (videoIds.length > 100) {
    console.error("More than 100 videos to look up");
  }
  let gamesQuery;
  let gameNames = [];
  if (gameIds.length > 0 && gameIds.length <= 100) {
    gamesQuery = "?id=" + gameIds.join("&id=");
    gameNames = (
      await fetch(`https://api.twitch.tv/helix/games${gamesQuery}`, {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })
        .then((res) => res.json())
        .catch((err) => console.error(err))
    ).data.map((x) => {
      return {
        id: x.id,
        name: x.name,
        boxart: x.box_art_url
          .replace("{width}", "600")
          .replace("{height}", "800"),
      };
    });
  } else if (gameIds.length > 100) {
    console.error("More than 100 games to look up");
  }
  const webhookClient = new WebhookClient({
    url: webhookUrl,
  });
  for (let i = 0; i < clips.length; i++) {
    if (suppressUntitled) {
      let video = videoTitles.find((x) => x.id == clips[i].video_id);
      if (video && video.title == clips[i].title) continue;
    }
    let content = `\`\`${clips[i].title.trim()}\`\`: ${clips[i].url}`;
    if (showCreatedDate) {
      let time = new Date(clips[i].created_at).getTime() / 1000;
      content += ` (Created at: <t:${time}:F> - <t:${time}:R>)`;
    }
    await webhookClient
      .send({
        username: clips[i].creator_name.trim(),
        avatarURL: profileImageUrls.find((x) => x.id == clips[i].creator_id)
          ?.profileImageUrl,
        content,
        embeds: [
          new EmbedBuilder()
            .setTitle(clips[i].title.trim())
            .setURL(clips[i].url)
            .addFields(
              {
                name: "Game",
                value: clips[i].game_id
                  ? gameNames.find((x) => x.id == clips[i].game_id)?.name
                  : "N/A",
                inline: true,
              },
              {
                name: "Streamer",
                value: clips[i].broadcaster_name
                  ? clips[i].broadcaster_name
                  : "N/A",
                inline: true,
              },
              {
                name: "Clipper",
                value: clips[i].creator_name ? clips[i].creator_name : "N/A",
                inline: true,
              },
              {
                name: "VOD",
                value: clips[i].video_id
                  ? `[${clips[i].video_id}](https://www.twitch.tv/videos/${clips[i].video_id})`
                  : "N/A",
                inline: true,
              },
              {
                name: "Language",
                value: clips[i].language ? clips[i].language : "N/A",
                inline: true,
              },
              {
                name: "Views",
                value: clips[i].view_count
                  ? clips[i].view_count.toString()
                  : "N/A",
                inline: true,
              },
              {
                name: "Created At",
                value: clips[i].created_at
                  ? `<t:${new Date(clips[i].created_at).getTime() / 1000}:F>`
                  : "N/A",
                inline: true,
              },
              {
                name: "Duration",
                value: clips[i].duration
                  ? `${clips[i].duration} seconds`
                  : "N/A",
                inline: true,
              },
              {
                name: "VOD Offset",
                value: clips[i].vod_offset
                  ? `${clips[i].vod_offset} seconds`
                  : "N/A",
                inline: true,
              },
              {
                name: "Featured",
                value:
                  clips[i].is_featured === false ||
                  clips[i].is_featured === true
                    ? clips[i].is_featured.toString()
                    : "N/A",
                inline: true,
              },
            )
            .setThumbnail(
              clips[i].game_id
                ? gameNames.find((x) => x.id == clips[i].game_id)?.boxart
                : undefined,
            )
            .setImage(clips[i].thumbnail_url),
        ],
      })
      .catch((err) => console.error);
  }
}
