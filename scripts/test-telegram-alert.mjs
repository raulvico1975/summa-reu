const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID || "68198321";

if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const text = [
  "Summa-Board: prova d'alerta de monitorització correcta.",
  "On ha passat: comprovació manual de configuració",
  "Impacte probable: cap impacte, és només una prova",
  `Moment: ${new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date())} (Europe/Madrid)`,
  "Origen: SERVER",
].join("\n");

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`Error enviant prova Telegram (${response.status}): ${body}`);
  process.exit(1);
}

console.log("Prova Telegram enviada correctament");
