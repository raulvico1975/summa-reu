import { Resend } from "resend";
import { adminAuth } from "@/src/lib/firebase/admin";
import { getOrgById } from "@/src/lib/db/repo";

const resendApiKey = process.env.RESEND_API_KEY;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function getOwnerEmail(orgId: string): Promise<string | null> {
  try {
    const user = await adminAuth.getUser(orgId);
    return user.email ?? null;
  } catch {
    return null;
  }
}

async function getOrgLanguage(orgId: string): Promise<"ca" | "es"> {
  const org = await getOrgById(orgId);
  return org?.language ?? "ca";
}

const emailStrings = {
  ca: {
    pollCreatedSubject: (title: string) => `Votació creada: "${title}"`,
    pollCreatedBody: (title: string) =>
      `<p>La votació <strong>${escapeHtml(title)}</strong> s'ha creat correctament.</p>`,
    pollCreatedShareCta: "Comparteix aquest enllaç amb els participants:",
    pollClosedSubject: (title: string) => `Votació tancada: "${title}"`,
    pollClosedBody: (title: string) =>
      `<p>La votació <strong>${escapeHtml(title)}</strong> s'ha tancat i s'ha convocat la reunió.</p>`,
    pollClosedCta: "Veure reunió",
  },
  es: {
    pollCreatedSubject: (title: string) => `Votación creada: "${title}"`,
    pollCreatedBody: (title: string) =>
      `<p>La votación <strong>${escapeHtml(title)}</strong> se ha creado correctamente.</p>`,
    pollCreatedShareCta: "Comparte este enlace con los participantes:",
    pollClosedSubject: (title: string) => `Votación cerrada: "${title}"`,
    pollClosedBody: (title: string) =>
      `<p>La votación <strong>${escapeHtml(title)}</strong> se ha cerrado y se ha convocado la reunión.</p>`,
    pollClosedCta: "Ver reunión",
  },
} as const;

export async function notifyOwnerPollCreated(input: {
  orgId: string;
  pollTitle: string;
  pollSlug: string;
}): Promise<void> {
  if (!resendApiKey) return;

  const ownerEmail = await getOwnerEmail(input.orgId);
  if (!ownerEmail) return;

  const lang = await getOrgLanguage(input.orgId);
  const strings = emailStrings[lang];
  const voteUrl = `https://summareu.app/p/${input.pollSlug}`;

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "Summa Reu <your-meeting@summareu.app>",
      to: ownerEmail,
      subject: strings.pollCreatedSubject(input.pollTitle),
      html: [
        strings.pollCreatedBody(input.pollTitle),
        `<p>${strings.pollCreatedShareCta}</p>`,
        `<p><a href="${voteUrl}">${voteUrl}</a></p>`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("poll_created_email_failed", input.orgId, error);
  }
}

export async function notifyOwnerPollClosed(input: {
  orgId: string;
  pollTitle: string;
  meetingId: string;
}): Promise<void> {
  if (!resendApiKey) return;

  const ownerEmail = await getOwnerEmail(input.orgId);
  if (!ownerEmail) return;

  const lang = await getOrgLanguage(input.orgId);
  const strings = emailStrings[lang];
  const meetingUrl = `https://summareu.app/owner/meetings/${input.meetingId}`;

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "Summa Reu <your-meeting@summareu.app>",
      to: ownerEmail,
      subject: strings.pollClosedSubject(input.pollTitle),
      html: [
        strings.pollClosedBody(input.pollTitle),
        `<p><a href="${meetingUrl}">${strings.pollClosedCta}</a></p>`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("poll_closed_email_failed", input.orgId, error);
  }
}
