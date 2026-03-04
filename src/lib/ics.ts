function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildMeetingIcs(params: {
  uid: string;
  title: string;
  description?: string;
  startsAt: Date;
  durationMinutes?: number;
  timezone?: string;
}): string {
  const now = new Date();
  const duration = params.durationMinutes ?? 60;
  const endsAt = new Date(params.startsAt.getTime() + duration * 60_000);
  const timezone = params.timezone ?? "Europe/Madrid";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SummaBoard//CA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(params.uid)}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART;TZID=${timezone}:${formatUtc(params.startsAt).replace("Z", "")}`,
    `DTEND;TZID=${timezone}:${formatUtc(endsAt).replace("Z", "")}`,
    `SUMMARY:${escapeIcs(params.title)}`,
    `DESCRIPTION:${escapeIcs(params.description ?? "Reunió creada des de SummaBoard")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
