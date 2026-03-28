import { clamp, shuffle } from "./shared.util.js";

export function createPools(noblePool, cityPool) {
  return {
    noblePool,
    cityPool,
    nobleById: new Map(noblePool.map((item) => [item.id, item])),
    cityById: new Map(cityPool.map((item) => [item.id, item])),
  };
}

export function getPool(pools, mode) {
  return mode === "cities" ? pools.cityPool : pools.noblePool;
}

export function getMaxCount(pools, mode) {
  return getPool(pools, mode).length;
}

export function normalizePlayers(value) {
  const source = Array.isArray(value)
    ? value
    : String(value)
        .trim()
        .split(/[,\s.~]+/);
  const seen = new Set();
  const players = [];

  for (const item of source) {
    const player = String(item).trim().replace(/\s+/g, " ");
    const key = player.toLocaleLowerCase();

    if (!player || seen.has(key)) {
      continue;
    }

    seen.add(key);
    players.push(player);
  }

  return players.slice(0, 8);
}

export function sanitizeClaims(claims, ids, players) {
  const validIds = new Set(ids);
  const validPlayers = new Set(players);
  const nextClaims = {};

  for (const [tileId, player] of Object.entries(claims)) {
    if (!validIds.has(tileId) || !validPlayers.has(player)) {
      continue;
    }

    nextClaims[tileId] = player;
  }

  return nextClaims;
}

export function parseHash(hash, pools) {
  // The URL hash is the shareable source of truth for the visible selection.
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const rawMode = params.get("mode");
  const mode = rawMode === "cities" ? "cities" : "nobles";
  const maxCount = Math.max(getMaxCount(pools, mode), 1);
  const rawCount = Number.parseInt(params.get("count") ?? "3", 10);
  const count = Number.isFinite(rawCount)
    ? clamp(rawCount, 1, maxCount)
    : clamp(3, 1, maxCount);
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const players = normalizePlayers(params.get("players") ?? "");

  return { mode, count, ids, players };
}

export function sanitizeState(pools, state, localClaims = {}) {
  // Normalize all external state before rendering so the UI can assume the
  // selection, player list, and claim assignments are internally consistent.
  const pool = getPool(pools, state.mode);
  const availableIds = new Set(pool.map((item) => item.id));
  const ids = [...new Set(state.ids)]
    .filter((id) => availableIds.has(id))
    .slice(0, state.count);
  const players = normalizePlayers(state.players ?? []);
  const claims = sanitizeClaims(localClaims, ids, players);

  if (ids.length === state.count) {
    return { ...state, ids, players, claims };
  }

  return generateRandomState(pools, state.mode, state.count, players, claims);
}

export function generateRandomState(
  pools,
  mode,
  count,
  players = [],
  claims = {},
) {
  // Shuffle a copy so the canonical pool remains stable for lookups and
  // reference grids.
  const pool = [...getPool(pools, mode)];
  const maxCount = getMaxCount(pools, mode);
  const nextCount = clamp(count, 1, maxCount);

  shuffle(pool);

  return {
    mode,
    count: nextCount,
    players: normalizePlayers(players),
    claims,
    ids: pool.slice(0, nextCount).map((item) => item.id),
  };
}

export function serializeState(state) {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  params.set("count", String(state.count));
  params.set("ids", state.ids.join(","));

  if (state.players.length > 0) {
    params.set("players", state.players.join("."));
  }

  return `#${params.toString()}`;
}

export function getSelection(pools, state) {
  const itemLookup = state.mode === "cities" ? pools.cityById : pools.nobleById;

  return state.ids
    .map((id) => itemLookup.get(id))
    .filter(Boolean);
}
