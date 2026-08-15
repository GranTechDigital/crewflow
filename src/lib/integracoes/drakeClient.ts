type DrakeClientOptions = {
  baseUrl?: string;
  syncPath?: string;
  syncSessionBasePath?: string;
  tenantId?: string;
  tenantHeaderName?: string;
  authHeaderName?: string;
  apiKey?: string;
  enabled?: boolean;
  timeoutMs?: number;
};

type DrakeRequestOptions = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export type DrakeResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  text: string;
};

export class DrakeClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseText?: string,
  ) {
    super(message);
    this.name = "DrakeClientError";
  }
}

function parseJsonSafe<T = unknown>(text: string): T | null {
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function bearerValue(apiKey?: string) {
  const value = (apiKey || "").trim();
  if (!value) return "";
  return value.toLowerCase().startsWith("bearer ") ? value : `Bearer ${value}`;
}

function cleanBaseUrl(url?: string) {
  return (url || "").trim().replace(/\/+$/, "");
}

function cleanPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function envEnabled() {
  return String(process.env.DRAKE_WEBHOOK_ENABLED || "false").toLowerCase() === "true";
}

export function getDrakeConfig(options: DrakeClientOptions = {}) {
  return {
    baseUrl: cleanBaseUrl(options.baseUrl ?? process.env.DRAKE_API_BASE_URL),
    syncPath:
      options.syncPath ??
      process.env.DRAKE_SYNC_PATH ??
      "/api/v2/Integration/Sync/SyncAdditionalEvent",
    syncWorkerPath:
      process.env.DRAKE_SYNC_WORKER_PATH ??
      "/api/v2/Integration/Sync/SyncWorker",
    syncSessionBasePath:
      options.syncSessionBasePath ??
      process.env.DRAKE_SYNC_SESSION_BASE_PATH ??
      "/api/v2/Integration/SyncSession",
    tenantId: options.tenantId ?? process.env.DRAKE_TENANT_ID,
    tenantHeaderName:
      options.tenantHeaderName ??
      process.env.DRAKE_TENANT_HEADER_NAME ??
      "X-SAPIENSIA-TenantId",
    authHeaderName:
      options.authHeaderName ??
      process.env.DRAKE_AUTH_HEADER_NAME ??
      "Authentication",
    apiKey: options.apiKey ?? process.env.DRAKE_API_KEY,
    enabled: options.enabled ?? envEnabled(),
    timeoutMs: options.timeoutMs ?? Number(process.env.DRAKE_TIMEOUT_MS || 30000),
  };
}

export function assertDrakeConfigReady(options: DrakeClientOptions = {}) {
  const config = getDrakeConfig(options);
  const missing = [
    ["DRAKE_API_BASE_URL", config.baseUrl],
    ["DRAKE_SYNC_PATH", config.syncPath],
    ["DRAKE_SYNC_WORKER_PATH", config.syncWorkerPath],
    ["DRAKE_SYNC_SESSION_BASE_PATH", config.syncSessionBasePath],
    ["DRAKE_TENANT_ID", config.tenantId],
    ["DRAKE_TENANT_HEADER_NAME", config.tenantHeaderName],
    ["DRAKE_AUTH_HEADER_NAME", config.authHeaderName],
    ["DRAKE_API_KEY", config.apiKey],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new DrakeClientError(
      `Configuracao Drake incompleta: ${missing.map(([key]) => key).join(", ")}`,
    );
  }

  return config;
}

export async function drakeRequest<T = unknown>(
  request: DrakeRequestOptions,
  options: DrakeClientOptions = {},
): Promise<DrakeResponse<T>> {
  const config = assertDrakeConfigReady(options);
  if (!config.enabled) {
    throw new DrakeClientError("Envio Drake desabilitado por DRAKE_WEBHOOK_ENABLED=false");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${cleanPath(request.path)}`, {
      method: request.method ?? "POST",
      headers: {
        [config.authHeaderName]: bearerValue(config.apiKey),
        [config.tenantHeaderName]: String(config.tenantId),
        "Content-Type": "application/json",
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new DrakeClientError("Drake respondeu com erro", response.status, text);
    }
    const data = parseJsonSafe<T>(text);

    return {
      ok: true,
      status: response.status,
      data,
      text,
    };
  } catch (error) {
    if (error instanceof DrakeClientError) throw error;
    if (error instanceof Error) {
      throw new DrakeClientError(error.message);
    }
    throw new DrakeClientError("Erro desconhecido ao chamar Drake");
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncAdditionalEvent<T = unknown>(
  payload: unknown,
  options: DrakeClientOptions = {},
) {
  const config = assertDrakeConfigReady(options);
  return drakeRequest<T>(
    {
      path: config.syncPath,
      method: "POST",
      body: payload,
    },
    options,
  );
}

export async function syncWorker<T = unknown>(
  payload: unknown,
  options: DrakeClientOptions = {},
) {
  const config = assertDrakeConfigReady(options);
  return drakeRequest<T>(
    {
      path: config.syncWorkerPath,
      method: "POST",
      body: payload,
    },
    options,
  );
}

function sessionPath(action: string, options: DrakeClientOptions = {}) {
  const config = assertDrakeConfigReady(options);
  return `${cleanPath(config.syncSessionBasePath).replace(/\/+$/, "")}/${action}`;
}

export async function startSyncSession<T = unknown>(
  payload: unknown = {},
  options: DrakeClientOptions = {},
) {
  return drakeRequest<T>(
    {
      path: sessionPath("Start", options),
      method: "POST",
      body: payload,
    },
    options,
  );
}

export async function addAdditionalEventBulk<T = unknown>(
  payload: unknown,
  options: DrakeClientOptions = {},
) {
  return drakeRequest<T>(
    {
      path: sessionPath("AddAdditionalEventBulk", options),
      method: "POST",
      body: payload,
    },
    options,
  );
}

export async function finalizeSyncSession<T = unknown>(
  payload: unknown = {},
  options: DrakeClientOptions = {},
) {
  return drakeRequest<T>(
    {
      path: sessionPath("SetFinalized", options),
      method: "POST",
      body: payload,
    },
    options,
  );
}

export async function getSyncSessionStatus<T = unknown>(
  payload: unknown = {},
  options: DrakeClientOptions = {},
) {
  return drakeRequest<T>(
    {
      path: sessionPath("Status", options),
      method: "POST",
      body: payload,
    },
    options,
  );
}

export async function getSyncSessionDetails<T = unknown>(
  payload: unknown = {},
  options: DrakeClientOptions = {},
) {
  return drakeRequest<T>(
    {
      path: sessionPath("Details", options),
      method: "POST",
      body: payload,
    },
    options,
  );
}
