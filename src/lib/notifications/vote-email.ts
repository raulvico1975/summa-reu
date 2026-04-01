import { Resend } from "resend";
import { adminAuth } from "@/src/lib/firebase/admin";
import { getOrgById } from "@/src/lib/db/repo";

const resendApiKey = process.env.RESEND_API_KEY;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const voteEmailStrings = {
  ca: {
    subject: (title: string) => `Nou vot a "${title}"`,
    body: (voterName: string, title: string) =>
      `<p><strong>${escapeHtml(voterName)}</strong> ha votat a la teva enquesta <strong>${escapeHtml(title)}</strong>.</p>`,
    cta: "Veure resultats",
  },
  es: {
    subject: (title: string) => `Nuevo voto en "${title}"`,
    body: (voterName: string, title: string) =>
      `<p><strong>${escapeHtml(voterName)}</strong> ha votado en tu encuesta <strong>${escapeHtml(title)}</strong>.</p>`,
    cta: "Ver resultados",
  },
} as const;

export async function notifyOwnerNewVote(input: {
  orgId: string;
  pollTitle: string;
  pollSlug: string;
  voterName: string;
}): Promise<void> {
  if (!resendApiKey) return;

  let ownerEmail: string | undefined;
  try {
    const user = await adminAuth.getUser(input.orgId);
    ownerEmail = user.email;
  } catch {
    return;
  }

  if (!ownerEmail) return;

  const org = await getOrgById(input.orgId);
  const lang = org?.language ?? "ca";
  const strings = voteEmailStrings[lang];
  const resultsUrl = `https://summareu.app/p/${input.pollSlug}/results`;

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "Summa Reu <your-meeting@summareu.app>",
      to: ownerEmail,
      subject: strings.subject(input.pollTitle),
      html: [
        strings.body(input.voterName, input.pollTitle),
        `<p><a href="${resultsUrl}">${strings.cta}</a></p>`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("vote_email_send_failed", input.orgId, error);
  }
}
