import { buildCityPool, buildNoblePool } from "./tiles.util.js";
import { createRenderer } from "./render.util.js";
import { DEV_MODE, DEV_RELOAD_TARGETS, PLAYER_ACCENTS } from "./constants.data.js";
import {
  createPools,
  generateRandomState,
  formatPlayerDraft,
  getMaxCount,
  getPool,
  getSelection,
  normalizePlayers,
  parseHash,
  sanitizeClaims,
  sanitizeState,
  serializeState,
} from "./state.util.js";
import { clamp, escapeHtml } from "./shared.util.js";

const elements = getElements();
const renderer = createRenderer(elements);

const ui = {
  activeClaimTileId: "",
  localClaims: {},
  nobleReferenceView: "picture",
  playerDraft: "",
  wakeLockHandle: null,
};

let pools = null;
let devReloadTimer = 0;

void init();

async function init() {
  try {
    pools = createPools(buildNoblePool(), buildCityPool());

    bindEvents();
    startDevAutoReload();
    renderer.showApp();

    if (!window.location.hash) {
      commitState(generateRandomState(pools, "nobles", 3));
      return;
    }

    renderFromHash();
  } catch (error) {
    renderer.renderError(error);
  }
}

function bindEvents() {
  // The hash stays authoritative for shareable state, so UI updates listen to
  // hash changes instead of maintaining a separate router/store layer.
  window.addEventListener("hashchange", renderFromHash);

  elements.controlsForm.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches('input[name="mode"]')) {
      commitFromControls();
    }
  });

  elements.playersEditor.addEventListener("click", () => {
    elements.playersEditorInput.focus();
  });

  elements.playersEditorInput.addEventListener("input", () => {
    handlePlayerDraftInput();
  });

  elements.playersEditorInput.addEventListener("blur", () => {
    commitPlayers();
  });

  elements.playersClearButton.addEventListener("click", () => {
    ui.playerDraft = "";
    syncPlayerEditor("", "", false);
    commitPlayers();
    elements.playersEditorInput.focus();
  });

  elements.playersEditorInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPlayers();
      return;
    }

    if (event.key === "Backspace" && !elements.playersEditorInput.value) {
      const players = normalizePlayers(elements.playersInput.value);
      if (!players.length) {
        return;
      }

      players.pop();
      syncPlayerEditor(players.join(" "), "", true);
    }
  });

  elements.countInput.addEventListener("input", () => {
    commitFromControls();
  });

  elements.rerollButton.addEventListener("click", () => {
    const mode = getSelectedMode();
    const count = clamp(
      Number.parseInt(elements.countInput.value, 10) || 1,
      1,
      getMaxCount(pools, mode),
    );

    commitState(
      generateRandomState(pools, mode, count, elements.playersInput.value),
    );
  });

  elements.shareButton.addEventListener("click", async () => {
    await shareCurrentSelection();
    elements.shareButton.textContent = "Shared";
    window.setTimeout(() => {
      elements.shareButton.textContent = "Share";
    }, 1400);
  });

  elements.fullscreenButton.addEventListener("click", toggleFullscreenMode);

  elements.resultsSection.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const claimButton = target.closest("[data-claim-tile]");
    if (claimButton) {
      event.stopPropagation();
      commitClaim(
        claimButton.getAttribute("data-claim-tile") ?? "",
        claimButton.getAttribute("data-claim-player") ?? "",
      );
      return;
    }

    const tile = target.closest("[data-tile-id]");
    if (!tile || !getCurrentState().players.length) {
      return;
    }

    ui.activeClaimTileId =
      ui.activeClaimTileId === tile.getAttribute("data-tile-id")
        ? ""
        : (tile.getAttribute("data-tile-id") ?? "");
    renderCurrentState();
  });

  [elements.nobleReference, elements.cityReference].forEach((grid) => {
    grid.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const tile = target.closest("[data-reference-tile-id]");
      if (!tile) {
        return;
      }

      toggleReferenceTile(
        tile.getAttribute("data-reference-mode") ?? "nobles",
        tile.getAttribute("data-reference-tile-id") ?? "",
      );
    });

    grid.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const tile = target.closest("[data-reference-tile-id]");
      if (!tile) {
        return;
      }

      event.preventDefault();
      toggleReferenceTile(
        tile.getAttribute("data-reference-mode") ?? "nobles",
        tile.getAttribute("data-reference-tile-id") ?? "",
      );
    });
  });

  elements.nobleViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      ui.nobleReferenceView = button.value === "labeled" ? "labeled" : "picture";
      renderCurrentState();
    });
  });

  elements.resultsSection.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (event.key === "Escape" && ui.activeClaimTileId) {
      ui.activeClaimTileId = "";
      renderCurrentState();
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const tile = target.closest("[data-tile-id]");
    if (!tile || !getCurrentState().players.length) {
      return;
    }

    event.preventDefault();
    ui.activeClaimTileId =
      ui.activeClaimTileId === tile.getAttribute("data-tile-id")
        ? ""
        : (tile.getAttribute("data-tile-id") ?? "");
    renderCurrentState();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !ui.activeClaimTileId) {
      return;
    }

    if (target.closest("[data-tile-id]")) {
      return;
    }

    ui.activeClaimTileId = "";
    renderCurrentState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !ui.activeClaimTileId) {
      return;
    }

    ui.activeClaimTileId = "";
    renderCurrentState();
  });
}

function startDevAutoReload() {
  if (!DEV_MODE || devReloadTimer || !window.isSecureContext) {
    return;
  }

  const signatures = new Map();

  void primeTargets();
  devReloadTimer = window.setInterval(() => {
    void checkTargets();
  }, 1200);

  async function primeTargets() {
    for (const target of DEV_RELOAD_TARGETS) {
      const signature = await fetchAssetSignature(target);
      if (signature) {
        signatures.set(target, signature);
      }
    }
  }

  async function checkTargets() {
    for (const target of DEV_RELOAD_TARGETS) {
      const nextSignature = await fetchAssetSignature(target);
      if (!nextSignature) {
        continue;
      }

      const previousSignature = signatures.get(target);
      if (previousSignature && previousSignature !== nextSignature) {
        window.location.reload();
        return;
      }

      signatures.set(target, nextSignature);
    }
  }
}

async function fetchAssetSignature(target) {
  try {
    const response = await fetch(`${target}?dev-check=${Date.now()}`, {
      cache: "no-store",
      method: "HEAD",
    });

    if (!response.ok) {
      return "";
    }

    return [
      response.headers.get("etag") ?? "",
      response.headers.get("last-modified") ?? "",
      response.headers.get("content-length") ?? "",
    ].join("|");
  } catch (_error) {
    return "";
  }
}

function commitPlayers() {
  const nextPlayers = normalizePlayers([
    ...normalizePlayers(elements.playersInput.value),
    ...normalizePlayers(ui.playerDraft),
  ]).join(" ");
  syncPlayerEditor(nextPlayers, "", false);

  const currentState = getCurrentState();
  commitState({
    ...currentState,
    players: nextPlayers,
  });
}

function commitFromControls() {
  const mode = getSelectedMode();
  const maxCount = getMaxCount(pools, mode);
  const count = clamp(Number.parseInt(elements.countInput.value, 10) || 1, 1, maxCount);

  elements.countInput.max = String(maxCount);
  elements.countInput.value = String(count);
  elements.countHint.textContent = `max ${maxCount}`;

  commitState(
    generateRandomState(pools, mode, count, elements.playersInput.value),
  );
}

function toggleReferenceTile(mode, tileId) {
  const currentState = getCurrentState();
  const nextMode = mode === "cities" ? "cities" : "nobles";
  const currentIds =
    currentState.mode === nextMode ? [...currentState.ids] : [];
  const existingIndex = currentIds.indexOf(tileId);

  if (existingIndex === -1) {
    currentIds.push(tileId);
  } else if (currentIds.length > 1) {
    currentIds.splice(existingIndex, 1);
  }

  const validIds = new Set(getPool(pools, nextMode).map((item) => item.id));
  const ids = currentIds.filter((id) => validIds.has(id));

  commitState({
    ...currentState,
    mode: nextMode,
    count: ids.length,
    ids,
    claims: {},
  });
}

function commitState(state, replace = false) {
  // Claims stay local-only, but the selected tiles and players are always
  // normalized back into the URL so the view remains shareable.
  const normalized = sanitizeState(pools, state, ui.localClaims);
  ui.localClaims = normalized.claims;
  const nextHash = serializeState(normalized);

  if (replace) {
    window.history.replaceState(null, "", nextHash);
    renderState(normalized);
    return;
  }

  if (window.location.hash === nextHash) {
    renderState(normalized);
    return;
  }

  window.location.hash = nextHash;
}

function renderFromHash() {
  // Claims are intentionally not part of the shared hash, so a hash-driven
  // state change resets local claim state and any open claim picker.
  ui.localClaims = {};
  ui.activeClaimTileId = "";
  ui.playerDraft = "";
  const nextState = sanitizeState(
    pools,
    parseHash(window.location.hash, pools),
  );
  commitState(nextState, true);
}

function renderCurrentState() {
  renderState(
    sanitizeState(
      pools,
      parseHash(window.location.hash, pools),
      ui.localClaims,
    ),
  );
}

function renderState(state) {
  syncPlayerEditor(state.players.join(" "), ui.playerDraft, false);
  renderer.renderApp({
    pools,
    activeClaimTileId: ui.activeClaimTileId,
    nobleReferenceView: ui.nobleReferenceView,
    state: {
      ...state,
      selection: getSelection(pools, state),
    },
  });
}

function getCurrentState() {
  return sanitizeState(
    pools,
    parseHash(window.location.hash, pools),
    ui.localClaims,
  );
}

function getSelectedMode() {
  return elements.modeInputs.find((input) => input.checked)?.value === "cities"
    ? "cities"
    : "nobles";
}

function commitClaim(tileId, player) {
  const nextState = getCurrentState();
  const nextClaims = { ...ui.localClaims };

  if (!player) {
    delete nextClaims[tileId];
  } else {
    nextClaims[tileId] = player;
  }

  ui.localClaims = sanitizeClaims(
    nextClaims,
    nextState.ids,
    normalizePlayers(nextState.players),
  );
  ui.activeClaimTileId = "";

  renderState({
    ...nextState,
    claims: ui.localClaims,
  });
}

async function shareCurrentSelection() {
  const shareUrl = window.location.href;

  if (navigator.share) {
    try {
      await navigator.share({ url: shareUrl });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareUrl);
    return;
  }

  window.prompt("Copy this URL", shareUrl);
}

async function toggleFullscreenMode() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      await releaseWakeLock();
      return;
    }

    await document.documentElement.requestFullscreen();
    await requestWakeLock();
  } catch (_error) {
    // Ignore unsupported fullscreen and wake-lock failures.
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || ui.wakeLockHandle) {
    return;
  }

  try {
    ui.wakeLockHandle = await navigator.wakeLock.request("screen");
    ui.wakeLockHandle.addEventListener("release", () => {
      ui.wakeLockHandle = null;
    });
  } catch (_error) {
    ui.wakeLockHandle = null;
  }
}

async function releaseWakeLock() {
  if (!ui.wakeLockHandle) {
    return;
  }

  await ui.wakeLockHandle.release();
  ui.wakeLockHandle = null;
}

function getElements() {
  return {
    appShell: document.getElementById("app-shell"),
    cityReference: document.getElementById("city-reference-grid"),
    controlsForm: document.getElementById("controls-form"),
    countHint: document.getElementById("count-hint"),
    countInput: document.getElementById("count-input"),
    errorMessage: document.getElementById("error-message"),
    errorPanel: document.getElementById("error-panel"),
    fullscreenButton: document.getElementById("fullscreen-button"),
    modeDescription: document.getElementById("mode-description"),
    modeInputs: [...document.querySelectorAll('input[name="mode"]')],
    nobleReference: document.getElementById("noble-reference-grid"),
    nobleViewButtons: [...document.querySelectorAll("[data-noble-view]")],
    nobleViewSwitcher: document.getElementById("noble-view-switcher"),
    playersEditor: document.getElementById("players-editor"),
    playersClearButton: document.getElementById("players-clear-button"),
    playersEditorInput: document.getElementById("players-editor-input"),
    playersEditorList: document.getElementById("players-editor-list"),
    playersInput: document.getElementById("players-input"),
    rerollButton: document.getElementById("reroll-button"),
    results: document.getElementById("results-grid"),
    resultsSection: document.getElementById("results-section"),
    shareButton: document.getElementById("share-button"),
    sourceLink: document.getElementById("source-link"),
  };
}

function handlePlayerDraftInput() {
  const rawDraft = formatPlayerDraft(elements.playersEditorInput.value);
  const hasTrailingSeparator = /[,\s.~]+$/.test(rawDraft);
  const parts = rawDraft.split(/[,\s.~]+/).filter(Boolean);
  const committedPlayers = hasTrailingSeparator ? parts : parts.slice(0, -1);
  const draftPlayer = hasTrailingSeparator ? "" : (parts.at(-1) ?? "");
  const nextPlayers = normalizePlayers([
    ...normalizePlayers(elements.playersInput.value),
    ...committedPlayers,
  ]).join(" ");

  syncPlayerEditor(nextPlayers, draftPlayer, committedPlayers.length > 0);
}

function syncPlayerEditor(value, draft = "", commitStateImmediately = false) {
  const players = normalizePlayers(value);
  ui.playerDraft = formatPlayerDraft(draft).replace(/[,\s.~]+/g, "");
  elements.playersInput.value = value;
  elements.playersEditorList.innerHTML = renderPlayerEditorMarkup(players);
  elements.playersEditorInput.value = ui.playerDraft;
  elements.playersEditor.classList.toggle("has-values", players.length > 0);
  elements.playersClearButton.classList.toggle(
    "hidden",
    players.length === 0 && !ui.playerDraft,
  );

  if (commitStateImmediately) {
    const currentState = getCurrentState();
    commitState({
      ...currentState,
      players: players.join(" "),
    });
  }
}

function renderPlayerEditorMarkup(players) {
  return players.map((player, index) => renderPlayerToken(player, index)).join("");
}

function renderPlayerToken(player, index) {
  const accent = PLAYER_ACCENTS[index % PLAYER_ACCENTS.length];
  return `
    <span
      class="player-editor-token"
      style="background:${accent.soft};border-color:${accent.strong};color:${accent.text};"
      contenteditable="false"
    >
      ${escapeHtml(player)}
    </span>
  `;
}
