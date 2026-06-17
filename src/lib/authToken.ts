import crypto from "crypto";
import jwt from "jsonwebtoken";

export type AuthTokenPayload = Record<string, unknown> & {
  iat?: number;
  exp?: number;
};

function getCandidateSecrets(): string[] {
  const candidates = [
    process.env.JWT_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.AUTH_SECRET,
    "fallback-secret",
  ].filter((value): value is string => Boolean(value && value.trim()));

  return [...new Set(candidates)];
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right)) {
    return false;
  }
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function signPayload(payloadHex: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`v1.${payloadHex}`)
    .digest("hex");
}

export async function signAuthToken(
  payload: AuthTokenPayload
): Promise<string> {
  const [primary] = getCandidateSecrets();
  const now = Math.floor(Date.now() / 1000);
  const payloadHex = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + 8 * 60 * 60,
    }),
    "utf8"
  ).toString("hex");
  return `v1.${payloadHex}.${signPayload(payloadHex, primary)}`;
}

export async function verifyAuthToken(token: string) {
  let lastError: unknown;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    for (const secret of getCandidateSecrets()) {
      try {
        const payload = jwt.verify(token, secret);
        if (payload && typeof payload === "object") {
          return { payload: payload as AuthTokenPayload };
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Formato de token invalido");
  }

  const [, payloadHex, signature] = parts;
  if (!/^[0-9a-f]+$/i.test(payloadHex)) {
    throw new Error("Payload de token invalido");
  }

  for (const secret of getCandidateSecrets()) {
    try {
      const expectedSignature = signPayload(payloadHex, secret);
      if (!timingSafeEqualHex(signature, expectedSignature)) {
        throw new Error("Assinatura de token invalida");
      }

      const payload = JSON.parse(
        Buffer.from(payloadHex, "hex").toString("utf8")
      ) as AuthTokenPayload;
      if (typeof payload.exp === "number" && payload.exp <= Date.now() / 1000) {
        throw new Error("Token expirado");
      }

      return { payload };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Falha ao verificar token");
}

export function isSecureRequest(input?: {
  protocol?: string;
  getHeader?: (name: string) => string | null;
}): boolean {
  const forceSecure = (process.env.FORCE_SECURE_COOKIES || "").toLowerCase();
  if (["1", "true", "yes", "on"].includes(forceSecure)) return true;

  if (input?.protocol === "https:") return true;
  const forwardedProto = input?.getHeader?.("x-forwarded-proto");
  return Boolean(forwardedProto?.toLowerCase().includes("https"));
}
