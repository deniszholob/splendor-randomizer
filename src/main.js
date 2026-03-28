import { buildCityPool, buildNoblePool } from "./tiles.util.js";
import { createRenderer } from "./render.util.js";
import {
  createPools,
  generateRandomState,
  getMaxCount,
  getSelection,
  normalizePlayers,
  parseHash,
  sanitizeClaims,
  sanitizeState,
  serializeState,
} from "./state.util.js";
import { clamp } from "./shared.util.js";

const elements = getElements();
const renderer = createRenderer(elements);

const ui = {
  activeClaimTileId: "",
  localClaims: {},
  wakeLockHandle: null,
};

let pools = null;

void init();

async function init() {
  try {
    pools = createPools(buildNoblePool(), buildCityPool());

    bindEvents();
    renderer.renderReference(pools);
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
      return;
    }

    if (target.matches('input[name="players"]')) {
      const currentState = getCurrentState();
      commitState({
        ...currentState,
        players: elements.playersInput.value,
      });
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
  renderer.renderApp({
    pools,
    activeClaimTileId: ui.activeClaimTileId,
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
    playerSummary: document.getElementById("player-summary"),
    playersInput: document.getElementById("players-input"),
    rerollButton: document.getElementById("reroll-button"),
    results: document.getElementById("results-grid"),
    resultsSection: document.getElementById("results-section"),
    shareButton: document.getElementById("share-button"),
    sourceLink: document.getElementById("source-link"),
  };
}
