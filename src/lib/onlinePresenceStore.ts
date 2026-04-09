type PresenceRecord = {
  usuarioId: number;
  nome: string;
  matricula: string;
  equipe: string;
  sessionStart?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  currentPath?: string;
  userAgent?: string;
};

const STORE_KEY = "__ONLINE_PRESENCE_STORE__";

function getStore(): Map<number, PresenceRecord> {
  const globalRef = globalThis as unknown as {
    [STORE_KEY]?: Map<number, PresenceRecord>;
  };

  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = new Map<number, PresenceRecord>();
  }
  return globalRef[STORE_KEY]!;
}

export function upsertPresence(
  payload: Omit<PresenceRecord, "firstSeenAt" | "lastSeenAt">,
  now = Date.now(),
) {
  const store = getStore();
  const current = store.get(payload.usuarioId);

  store.set(payload.usuarioId, {
    ...payload,
    firstSeenAt: current?.firstSeenAt ?? now,
    lastSeenAt: now,
  });
}

export function markPresenceOffline(usuarioId: number) {
  const store = getStore();
  store.delete(usuarioId);
}

export function getPresenceSnapshot(
  onlineWindowMs: number,
  recentWindowMs = 24 * 60 * 60 * 1000,
) {
  const store = getStore();
  const now = Date.now();
  const onlineThreshold = now - onlineWindowMs;
  const recentThreshold = now - recentWindowMs;

  // Limpeza de registros antigos
  for (const [userId, record] of store.entries()) {
    if (record.lastSeenAt < recentThreshold) {
      store.delete(userId);
    }
  }

  const all = Array.from(store.values()).sort(
    (a, b) => b.lastSeenAt - a.lastSeenAt,
  );
  const online = all.filter((record) => record.lastSeenAt >= onlineThreshold);

  return {
    now,
    totalTracked: all.length,
    onlineNow: online,
    allTracked: all,
  };
}

