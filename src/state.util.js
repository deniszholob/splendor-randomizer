import { URL_TILE_DELIMITER } from "./constants.data.js";
import { clamp, shuffle, toTitleCaseWord } from "./shared.util.js";

export function createPools(noblePool, cityPool) {
  return {
    noblePool,
    cityPool,
    nobleById: new Map(noblePool.map((item) => [item.id, item])),
    cityById: new Map(cityPool.map((item) => [item.id, item])),
    nobleCodeById: new Map(noblePool.map((item, index) => [item.id, String(index + 1)])),
    cityCodeById: new Map(cityPool.map((item, index) => [item.id, String(index + 1)])),
    nobleIdByCode: new Map(noblePool.map((item, index) => [String(index + 1), item.id])),
    cityIdByCode: new Map(cityPool.map((item, index) => [String(index + 1), item.id])),
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
    const player = toTitleCaseWord(String(item).trim().replace(/\s+/g, ""));
    const key = player.toLocaleLowerCase();

    if (!player || seen.has(key)) {
      continue;
    }

    seen.add(key);
    players.push(player);
  }

  return players.slice(0, 8);
}

export function formatPlayerDraft(value) {
  return String(value).replace(/[^\s,~.]+/g, (item) => toTitleCaseWord(item));
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
  const rawMode = params.get("m");
  const mode = rawMode === "c" ? "cities" : rawMode === "n" ? "nobles" : "";

  if (!mode) {
    return null;
  }

  const rawTiles = params.get("t") ?? "";
  const tileCodes = rawTiles
    .split(new RegExp(escapeRegExp(URL_TILE_DELIMITER)))
    .map((code) => code.trim())
    .filter(Boolean);
  const codeLookup = mode === "cities" ? pools.cityIdByCode : pools.nobleIdByCode;
  const ids = tileCodes.map((code) => codeLookup.get(code) ?? "");

  if (!ids.length || ids.some((id) => !id)) {
    return null;
  }

  const maxCount = Math.max(getMaxCount(pools, mode), 1);
  const rawCountParam = params.get("c");
  const rawCount = rawCountParam === null
    ? ids.length
    : Number.parseInt(rawCountParam, 10);

  if (!Number.isFinite(rawCount)) {
    return null;
  }

  const fallbackCount = rawCount;
  const count = clamp(rawCountParam === null ? ids.length : fallbackCount, 1, maxCount);
  const players = normalizePlayers(params.get("p") ?? "");

  return { mode, count, ids, players };
}

export function sanitizeState(pools, state, localClaims = {}) {
  // Normalize all external state before rendering so the UI can assume the
  // selection, player list, and claim assignments are internally consistent.
  const pool = getPool(pools, state.mode);
  const availableIds = new Set(pool.map((item) => item.id));
  const ids = sortTileIds(
    pools,
    state.mode,
    [...new Set(state.ids)]
      .filter((id) => availableIds.has(id)),
  )
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
    ids: sortTileIds(
      pools,
      mode,
      pool.slice(0, nextCount).map((item) => item.id),
    ),
  };
}

export function serializeState(state, pools, { countOverridden = false } = {}) {
  const params = new URLSearchParams();
  params.set("m", state.mode === "cities" ? "c" : "n");
  params.set(
    "t",
    state.ids
      .map((id) => encodeTileId(pools, state.mode, id))
      .join(URL_TILE_DELIMITER),
  );

  if (state.players.length > 0) {
    params.set("p", state.players.join(URL_TILE_DELIMITER));
  }

  if (countOverridden || state.players.length === 0) {
    params.set("c", String(state.count));
  }

  return `#${params.toString()}`;
}

export function getSelection(pools, state) {
  const itemLookup = state.mode === "cities" ? pools.cityById : pools.nobleById;

  return state.ids
    .map((id) => itemLookup.get(id))
    .filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encodeTileId(pools, mode, id) {
  const codeLookup = mode === "cities" ? pools.cityCodeById : pools.nobleCodeById;
  return codeLookup.get(id) ?? "";
}

function sortTileIds(pools, mode, ids) {
  return [...ids].sort((left, right) => {
    return getTileCodeNumber(pools, mode, left) - getTileCodeNumber(pools, mode, right);
  });
}

function getTileCodeNumber(pools, mode, id) {
  const code = encodeTileId(pools, mode, id);
  const number = Number.parseInt(code, 10);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}
