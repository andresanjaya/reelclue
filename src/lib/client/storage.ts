export type ModeLevelStat = {
  games_played: number;
  total_score: number;
  best_score: number;
  total_correct_rounds: number;
  total_rounds: number;
  total_hints_used: number;
  total_wrong_attempts: number;
};

export type LastSessionRecord = {
  id: string;
  mode: string;
  level: string;
  saved_at: string;
  state: "active" | "completed";
};

export type ReelClueStorageData = {
  version: number;
  completed_session_ids: string[];
  recent_movie_ids: number[];
  stats: Record<string, ModeLevelStat>;
  preferences: {
    mode?: string;
    level?: string;
  };
  last_session: LastSessionRecord | null;
};

export const STORAGE_KEY = "reelclue_local_v1";
export const SCHEMA_VERSION = 1;
export const MAX_COMPLETED_SESSIONS = 100;
export const MAX_RECENT_MOVIES = 30;

export function getDefaultStorageData(): ReelClueStorageData {
  return {
    version: SCHEMA_VERSION,
    completed_session_ids: [],
    recent_movie_ids: [],
    stats: {},
    preferences: {},
    last_session: null,
  };
}

// In-memory fallback if localStorage is unavailable or blocked (e.g. private browsing with strict storage restrictions)
let memoryStorage: ReelClueStorageData | null = null;

export function _resetMemoryStorageForTesting(): void {
  memoryStorage = null;
}

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__reelclue_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadLocalData(): ReelClueStorageData {
  if (!isLocalStorageAvailable()) {
    if (!memoryStorage) {
      memoryStorage = getDefaultStorageData();
    }
    return memoryStorage;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return memoryStorage ?? getDefaultStorageData();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== SCHEMA_VERSION) {
      // Corrupt or unrecognized schema version: heal with clean default
      const defaultData = getDefaultStorageData();
      saveLocalData(defaultData);
      return defaultData;
    }

    // Defensive validation & boundary enforcement
    const completed_session_ids = Array.isArray(parsed.completed_session_ids)
      ? parsed.completed_session_ids.filter((id: unknown) => typeof id === "string").slice(-MAX_COMPLETED_SESSIONS)
      : [];

    const recent_movie_ids = Array.isArray(parsed.recent_movie_ids)
      ? parsed.recent_movie_ids.filter((id: unknown) => typeof id === "number").slice(-MAX_RECENT_MOVIES)
      : [];

    const stats: Record<string, ModeLevelStat> = {};
    if (parsed.stats && typeof parsed.stats === "object") {
      for (const [key, val] of Object.entries(parsed.stats)) {
        if (val && typeof val === "object") {
          const s = val as Partial<ModeLevelStat>;
          stats[key] = {
            games_played: typeof s.games_played === "number" ? s.games_played : 0,
            total_score: typeof s.total_score === "number" ? s.total_score : 0,
            best_score: typeof s.best_score === "number" ? s.best_score : 0,
            total_correct_rounds: typeof s.total_correct_rounds === "number" ? s.total_correct_rounds : 0,
            total_rounds: typeof s.total_rounds === "number" ? s.total_rounds : 0,
            total_hints_used: typeof s.total_hints_used === "number" ? s.total_hints_used : 0,
            total_wrong_attempts: typeof s.total_wrong_attempts === "number" ? s.total_wrong_attempts : 0,
          };
        }
      }
    }

    const preferences =
      parsed.preferences && typeof parsed.preferences === "object"
        ? {
            mode: typeof parsed.preferences.mode === "string" ? parsed.preferences.mode : undefined,
            level: typeof parsed.preferences.level === "string" ? parsed.preferences.level : undefined,
          }
        : {};

    let last_session: LastSessionRecord | null = null;
    if (parsed.last_session && typeof parsed.last_session === "object") {
      const ls = parsed.last_session as Partial<LastSessionRecord>;
      if (typeof ls.id === "string" && typeof ls.mode === "string" && typeof ls.level === "string") {
        last_session = {
          id: ls.id,
          mode: ls.mode,
          level: ls.level,
          saved_at: typeof ls.saved_at === "string" ? ls.saved_at : new Date().toISOString(),
          state: ls.state === "completed" ? "completed" : "active",
        };
      }
    }

    return {
      version: SCHEMA_VERSION,
      completed_session_ids,
      recent_movie_ids,
      stats,
      preferences,
      last_session,
    };
  } catch {
    // Fail safely without disrupting gameplay
    return memoryStorage ?? getDefaultStorageData();
  }
}

export function saveLocalData(data: ReelClueStorageData): boolean {
  memoryStorage = data;
  if (!isLocalStorageAvailable()) {
    return true;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // QuotaExceededError or security policy failure handled gracefully
    return false;
  }
}

export function recordCompletedSession(result: {
  id: string;
  mode: string;
  level: string;
  score: number;
  correct_count: number;
  total_rounds: number;
  total_hints_used: number;
  total_wrong_attempts: number;
  rounds: Array<{ reveal: { tmdb_id: number } }>;
}): boolean {
  const data = loadLocalData();

  // Deduplication check: only append once per session ID
  if (data.completed_session_ids.includes(result.id)) {
    return false; // Already recorded
  }

  // 1. Append session ID (capped at MAX_COMPLETED_SESSIONS)
  const completed_session_ids = [...data.completed_session_ids, result.id].slice(-MAX_COMPLETED_SESSIONS);

  // 2. Append recent movie IDs (capped at MAX_RECENT_MOVIES)
  const movieIds = result.rounds.map(r => r.reveal.tmdb_id).filter(id => typeof id === "number" && id > 0);
  const recent_movie_ids = [...data.recent_movie_ids, ...movieIds].slice(-MAX_RECENT_MOVIES);

  // 3. Update stats for mode + level key
  const statKey = `${result.mode}:${result.level.toLowerCase()}`;
  const current = data.stats[statKey] ?? {
    games_played: 0,
    total_score: 0,
    best_score: 0,
    total_correct_rounds: 0,
    total_rounds: 0,
    total_hints_used: 0,
    total_wrong_attempts: 0,
  };

  const updatedStat: ModeLevelStat = {
    games_played: current.games_played + 1,
    total_score: current.total_score + result.score,
    best_score: Math.max(current.best_score, result.score),
    total_correct_rounds: current.total_correct_rounds + result.correct_count,
    total_rounds: current.total_rounds + result.total_rounds,
    total_hints_used: current.total_hints_used + result.total_hints_used,
    total_wrong_attempts: current.total_wrong_attempts + result.total_wrong_attempts,
  };

  const stats = {
    ...data.stats,
    [statKey]: updatedStat,
  };

  // 4. Update last_session state if matches
  let last_session = data.last_session;
  if (last_session && last_session.id === result.id) {
    last_session = {
      ...last_session,
      state: "completed",
    };
  }

  saveLocalData({
    ...data,
    completed_session_ids,
    recent_movie_ids,
    stats,
    last_session,
  });

  return true;
}

export function saveActiveSession(session: {
  id: string;
  mode: string;
  level: string;
}): void {
  const data = loadLocalData();
  saveLocalData({
    ...data,
    last_session: {
      id: session.id,
      mode: session.mode,
      level: session.level.toLowerCase(),
      saved_at: new Date().toISOString(),
      state: "active",
    },
    preferences: {
      ...data.preferences,
      mode: session.mode,
      level: session.level.toLowerCase(),
    },
  });
}

export function markActiveSessionCompleted(sessionId: string): void {
  const data = loadLocalData();
  if (data.last_session && data.last_session.id === sessionId) {
    saveLocalData({
      ...data,
      last_session: {
        ...data.last_session,
        state: "completed",
      },
    });
  }
}

export function savePreferences(preferences: {
  mode?: string;
  level?: string;
}): void {
  const data = loadLocalData();
  saveLocalData({
    ...data,
    preferences: {
      ...data.preferences,
      ...(preferences.mode ? { mode: preferences.mode } : {}),
      ...(preferences.level ? { level: preferences.level.toLowerCase() } : {}),
    },
  });
}

export function clearLocalHistory(): void {
  const data = loadLocalData();
  // Clear game history & stats, but preserve user preferences
  saveLocalData({
    version: SCHEMA_VERSION,
    completed_session_ids: [],
    recent_movie_ids: [],
    stats: {},
    preferences: data.preferences ?? {},
    last_session: null,
  });
}

export function dismissActiveSession(): void {
  const data = loadLocalData();
  saveLocalData({
    ...data,
    last_session: null,
  });
}

export function getActiveResumableSession(): LastSessionRecord | null {
  const data = loadLocalData();
  if (!data.last_session || data.last_session.state !== "active") {
    return null;
  }
  const savedTime = new Date(data.last_session.saved_at).getTime();
  if (isNaN(savedTime) || Date.now() - savedTime > 24 * 60 * 60 * 1000) {
    return null;
  }
  return data.last_session;
}

