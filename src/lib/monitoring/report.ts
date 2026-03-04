import { ZodError } from "zod";
import { notifyTelegramIncident } from "@/src/lib/monitoring/telegram";

function trimMessage(message: string, max = 160): string {
  if (message.length <= max) return message;
  return `${message.slice(0, max - 1)}…`;
}

export function isExpectedUserError(error: unknown): boolean {
  if (error instanceof ZodError) {
    return true;
  }

  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code);
    if (code.startsWith("auth/")) {
      return true;
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("no autoritzat")) return true;
    if (msg.includes("dades no vàlides")) return true;
    if (msg.includes("missing meetingid")) return true;
    if (msg.includes("poll not found")) return true;
    if (msg.includes("id token")) return true;
    if (msg.includes("password is invalid")) return true;
    if (msg.includes("there is no user record")) return true;
  }

  return false;
}

export async function reportApiUnexpectedError(input: {
  route: string;
  action: string;
  error: unknown;
  dedupeKey?: string;
}): Promise<void> {
  if (isExpectedUserError(input.error)) {
    return;
  }

  const details = input.error instanceof Error ? trimMessage(input.error.message) : "Error no identificat";
  await notifyTelegramIncident({
    source: "api",
    summary: `Hem detectat un problema mentre ${input.action}.`,
    where: input.route,
    impact: "Algunes entitats poden trobar-se amb una acció que no respon com esperaven.",
    userAction: "Si cal, torna-ho a provar en uns minuts. L'equip ho està revisant.",
    dedupeKey: input.dedupeKey ?? `${input.route}:${details}`,
  });
}

export async function reportServerUnexpectedError(input: {
  stage: string;
  error: unknown;
  dedupeKey?: string;
}): Promise<void> {
  const details = input.error instanceof Error ? trimMessage(input.error.message) : "Error no identificat";
  await notifyTelegramIncident({
    source: "server",
    summary: "S'ha detectat una incidència interna de l'aplicació.",
    where: input.stage,
    impact: "Algunes pantalles poden carregar amb errors o no completar operacions.",
    userAction: "L'equip ja ha rebut l'avís i està fent seguiment.",
    dedupeKey: input.dedupeKey ?? `${input.stage}:${details}`,
  });
}

export async function reportClientRuntimeError(input: {
  page: string;
  kind: "error" | "unhandledrejection";
  message?: string;
  dedupeKey: string;
}): Promise<void> {
  const humanKind =
    input.kind === "unhandledrejection" ? "resposta inesperada del navegador" : "error de visualització";

  await notifyTelegramIncident({
    source: "client",
    summary: `Hem detectat un possible bloqueig a la pantalla (${humanKind}).`,
    where: input.page,
    impact: "Algunes persones usuàries poden veure la pàgina inestable o no interactiva.",
    userAction: "Recarrega la pàgina. Si persisteix, revisarem la incidència amb prioritat.",
    dedupeKey: input.dedupeKey,
  });
}
