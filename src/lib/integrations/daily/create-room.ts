type DailyRoomResponse = {
  name?: string;
  url?: string;
};

function buildDailyRoomUrl(domain: string, roomName: string): string {
  const trimmedDomain = domain.replace(/\/+$/, "");

  if (trimmedDomain.startsWith("http://") || trimmedDomain.startsWith("https://")) {
    return `${trimmedDomain}/${roomName}`;
  }

  if (trimmedDomain.includes(".")) {
    return `https://${trimmedDomain}/${roomName}`;
  }

  return `https://${trimmedDomain}.daily.co/${roomName}`;
}

export async function createDailyRoom(meetingId: string) {
  const apiKey = process.env.DAILY_API_KEY;
  const apiBaseUrl = process.env.DAILY_API_BASE_URL ?? "https://api.daily.co/v1";
  const domain = process.env.DAILY_DOMAIN;
  const mockMode = process.env.DAILY_MOCK_MODE === "true";
  const roomName = `meeting-${meetingId}`;

  if (mockMode) {
    return {
      roomName,
      roomUrl: buildDailyRoomUrl(domain ?? "mock.daily.local", roomName),
    };
  }

  if (!apiKey || !domain) {
    throw new Error("DAILY_NOT_CONFIGURED");
  }

  const res = await fetch(`${apiBaseUrl}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        enable_chat: true,
        enable_screenshare: true,
        enable_recording: "cloud-audio-only",
        start_video_off: false,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily create room failed: ${text}`);
  }

  const data = (await res.json()) as DailyRoomResponse;
  const resolvedRoomName = data.name ?? roomName;

  return {
    roomName: resolvedRoomName,
    roomUrl: data.url ?? buildDailyRoomUrl(domain, resolvedRoomName),
  };
}
