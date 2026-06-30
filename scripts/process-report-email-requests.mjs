import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getRequestKeywords() {
  const configured = process.env.REPORT_REQUEST_KEYWORDS || process.env.REPORT_REQUEST_KEYWORD || "relatorio";
  return parseList(configured)
    .map(normalizeText)
    .filter(Boolean);
}

function parseList(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFromAddress(parsed) {
  return normalizeEmail(parsed.from?.value?.[0]?.address || "");
}

function getReplyText(parsed) {
  const content = [parsed.text, parsed.subject, parsed.html].filter(Boolean).join("\n");
  return content
    .split(/\n\s*(?:em\s+.+escreveu:|on\s+.+wrote:|de:\s|from:\s|-----original message-----)/i)[0]
    .trim();
}

function hasRequestKeyword(parsed) {
  const content = normalizeText(getReplyText(parsed));
  return getRequestKeywords().some((keyword) => content.includes(keyword));
}

function extractRequestedDate(parsed) {
  const content = normalizeText(getReplyText(parsed));
  if (!getRequestKeywords().some((keyword) => content.includes(keyword))) return null;

  if (/\bhoje\b/.test(content)) return "hoje";
  if (/\bontem\b/.test(content)) return "ontem";

  const brDate = content.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/);
  if (brDate) return brDate[1];

  const isoDate = content.match(/\b(\d{4}-\d{1,2}-\d{1,2})\b/);
  if (isoDate) return isoDate[1];

  return "hoje";
}

async function requestReport({ recipient, subject, requestedDate }) {
  const endpoint =
    process.env.REPORT_ENDPOINT ||
    (process.env.REPORT_GENERAL_API_BASE ? `${process.env.REPORT_GENERAL_API_BASE.replace(/\/$/, "")}/email` : "");
  if (!endpoint) {
    throw new Error("REPORT_ENDPOINT or REPORT_GENERAL_API_BASE is required");
  }
  const token = requiredEnv("REPORT_TOKEN");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipients: [recipient],
      requestedBy: recipient,
      requestedDate,
      saveSnapshot: false,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Report request failed for ${recipient} (${response.status}): ${body}`);
  }

  console.log(`Relatório solicitado enviado para ${recipient}. Data solicitada: ${requestedDate || "hoje"}. Assunto recebido: ${subject || "(sem assunto)"}`);
}

async function main() {
  const host = process.env.IMAP_HOST || process.env.SMTP_HOST || "granhub.com.br";
  const port = Number(process.env.IMAP_PORT || "993");
  const secure =
    process.env.IMAP_SECURE === undefined ? port === 993 : String(process.env.IMAP_SECURE).toLowerCase() === "true";
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  const maxPerRun = Number(process.env.REPORT_REQUEST_MAX_PER_RUN || "5");
  const maxPerSender = Number(process.env.REPORT_REQUEST_MAX_PER_SENDER_PER_RUN || "1");
  const sentBySender = new Map();

  if (!user || !pass) {
    throw new Error("IMAP_USER/IMAP_PASS or SMTP_USER/SMTP_PASS are required");
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");

  try {
    const unseenUids = await client.search({ seen: false });
    let sentCount = 0;

    for (const uid of unseenUids) {
      if (sentCount >= maxPerRun) break;

      const message = await client.fetchOne(uid, { source: true, envelope: true, uid: true }, { uid: true });
      if (!message?.source) {
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        continue;
      }

      const parsed = await simpleParser(message.source);
      const from = getFromAddress(parsed);
      const isDeliveryStatus = from === "mailer-daemon@granhub.com.br" || from.startsWith("mailer-daemon@");
      const requested = hasRequestKeyword(parsed);
      const requestedDate = requested ? extractRequestedDate(parsed) : null;
      const senderSentCount = sentBySender.get(from) || 0;

      if (isDeliveryStatus) {
        console.log(`Ignorado retorno automático de entrega: ${parsed.subject || "(sem assunto)"}`);
      } else if (requested && senderSentCount < maxPerSender) {
        try {
          await requestReport({ recipient: from, subject: parsed.subject, requestedDate });
          sentBySender.set(from, senderSentCount + 1);
          sentCount += 1;
        } catch (error) {
          console.log(error instanceof Error ? error.message : `Falha ao processar solicitação de ${from}`);
        }
      } else if (!requested) {
        console.log(`Ignorado e-mail sem palavra-chave de relatório: ${from}`);
      } else {
        console.log(`Limite por execução atingido para ${from}`);
      }

      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    }

    console.log(`Processamento finalizado. Relatórios enviados: ${sentCount}. E-mails não lidos avaliados: ${unseenUids.length}.`);
  } finally {
    lock.release();
    await client.logout();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
