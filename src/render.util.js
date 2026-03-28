import {
  COLOR_LABELS,
  COLORS,
  DEV_MODE,
  GITHUB_LINK,
  PLAYER_ACCENTS,
  URL_TILE_DELIMITER,
} from "./constants.data.js";
import {
  buildImageCandidates,
  comboId,
  normalizeColors,
} from "./tiles.util.js";
import { escapeHtml } from "./shared.util.js";

export function createRenderer(elements) {
  elements.sourceLink.href = GITHUB_LINK;
  let referenceSignature = "";

  return {
    renderApp({ countOverridden, nobleReferenceView, pools, state, activeClaimTileId }) {
      document.title = "Splendor Randomizer";
      syncControls(elements, pools, state, nobleReferenceView, countOverridden);
      elements.modeDescription.textContent = `Generate a random set of ${state.mode}, share the URL so everyone sees the same tiles, then mark claimed tiles by player as the game moves.`;
      elements.results.className =
        state.mode === "cities"
          ? "result-board result-board-cities"
          : "result-board";
      elements.results.innerHTML = renderSelection(
        state,
        activeClaimTileId,
        nobleReferenceView,
      );
      wireImageFallback(elements.results);
      wireStaticImageFallback(elements.results);

      const nextReferenceSignature = `${nobleReferenceView}|${state.mode}|${state.ids.join(URL_TILE_DELIMITER)}`;

      if (referenceSignature !== nextReferenceSignature) {
        referenceSignature = nextReferenceSignature;
        elements.nobleReference.innerHTML = renderNobleReference(
          pools,
          state,
          nobleReferenceView,
        );
        elements.cityReference.innerHTML = renderCityReference(
          pools.cityPool,
          state,
        );
        wireImageFallback(elements.nobleReference);
        wireStaticImageFallback(elements.nobleReference);
        wireStaticImageFallback(elements.cityReference);
      }
    },

    renderError(error) {
      document.title = "Splendor Randomizer";
      elements.appShell.classList.add("hidden");
      elements.errorPanel.classList.remove("hidden");
      elements.errorMessage.textContent =
        error instanceof Error ? error.message : "Unknown error";
    },

    showApp() {
      elements.appShell.classList.remove("hidden");
      elements.errorPanel.classList.add("hidden");
    },
  };
}

function syncControls(elements, pools, state, nobleReferenceView, countOverridden) {
  const maxCount =
    state.mode === "cities" ? pools.cityPool.length : pools.noblePool.length;

  elements.modeInputs.forEach((input) => {
    input.checked = input.value === state.mode;
  });
  elements.countInput.max = String(maxCount);
  elements.countInput.value = String(state.count);
  elements.countInput.disabled = !countOverridden;
  elements.countOverrideInput.checked = countOverridden;
  elements.countHint.textContent = `max ${maxCount}`;

  if (!DEV_MODE) {
    elements.nobleViewSwitcher.hidden = true;
    elements.nobleViewSwitcher.setAttribute("aria-hidden", "true");
    elements.nobleViewSwitcher.classList.add("hidden");
    elements.nobleViewSwitcher.style.display = "none";
    return;
  }

  elements.nobleViewSwitcher.hidden = false;
  elements.nobleViewSwitcher.setAttribute("aria-hidden", "false");
  elements.nobleViewSwitcher.classList.remove("hidden");
  elements.nobleViewSwitcher.style.display = "grid";
  elements.nobleViewButtons.forEach((button) => {
    const isActive = button.value === nobleReferenceView;
    button.setAttribute("aria-pressed", String(isActive));
    button.classList.toggle("bg-amber-100/14", isActive);
    button.classList.toggle("text-amber-100", isActive);
    button.classList.toggle("bg-transparent", !isActive);
    button.classList.toggle("text-slate-300", !isActive);
  });
}

function renderSelection(state, activeClaimTileId, nobleReferenceView) {
  return state.selection
    .map((item) => {
      return item.kind === "cities"
        ? renderCityCard(item, {
            activeClaimTileId,
            interactive: true,
            players: state.players,
            claims: state.claims,
          })
        : renderNobleCard(item, {
            activeClaimTileId,
            interactive: true,
            players: state.players,
            claims: state.claims,
            showImage: nobleReferenceView === "picture",
            showColorChips: nobleReferenceView === "labeled",
            showReferenceBadges: nobleReferenceView === "labeled",
          });
    })
    .join("");
}

function renderNobleReference(pools, state, nobleReferenceView) {
  const cards = [];
  const { nobleById } = pools;
  const selectedIds = state.mode === "nobles" ? new Set(state.ids) : new Set();

  for (let rowIndex = 0; rowIndex < COLORS.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < COLORS.length; columnIndex += 1) {
      const rowColor = COLORS[rowIndex];
      const columnColor = COLORS[columnIndex];

      if (rowIndex === columnIndex) {
        cards.push(
          renderTokenCard(rowColor, {
            showImage: nobleReferenceView === "picture",
            showReferenceBadges: nobleReferenceView === "labeled",
            showColorChips: nobleReferenceView === "labeled",
          }),
        );
        continue;
      }

      if (columnIndex < rowIndex) {
        const pairColors = normalizeColors([rowColor, columnColor]);
        const pair = nobleById.get(comboId(pairColors));
        if (pair) {
          cards.push(
            renderNobleCard(pair, {
              selectedIds,
              showImage: nobleReferenceView === "picture",
              showReferenceBadges: nobleReferenceView === "labeled",
              showColorChips: nobleReferenceView === "labeled",
              referenceMode: "nobles",
            }),
          );
        }
        continue;
      }

      const tripletColors = COLORS.filter(
        (color) => color !== rowColor && color !== columnColor,
      );
      const triplet = nobleById.get(comboId(tripletColors));
      if (triplet) {
        cards.push(
          renderNobleCard(triplet, {
            selectedIds,
            showImage: nobleReferenceView === "picture",
            showReferenceBadges: nobleReferenceView === "labeled",
            showColorChips: nobleReferenceView === "labeled",
            referenceMode: "nobles",
          }),
        );
      }
    }
  }

  return cards.join("");
}

function renderCityReference(cityPool, state) {
  const selectedIds = state.mode === "cities" ? new Set(state.ids) : new Set();

  return cityPool
    .map((city) =>
      renderCityCard(city, {
        referenceMode: "cities",
        selectedIds,
      }),
    )
    .join("");
}

function renderNobleCard(
  combo,
  {
    activeClaimTileId = "",
    claims = {},
    interactive = false,
    players = [],
    referenceMode = "",
    selectedIds = new Set(),
    showColorChips = false,
    showImage = true,
    showReferenceBadges = false,
  } = {},
) {
  const badgeText = combo.colors.length === 2 ? "Double" : "Triplet";
  const ariaLabel = `Noble for ${combo.colors.map((color) => COLOR_LABELS[color]).join(", ")}`;
  const claimedBy = claims?.[combo.id] ?? "";
  const isClaiming = interactive && activeClaimTileId === combo.id;
  const isSelected = selectedIds.has(combo.id);
  const cardStyle = claimedBy ? claimTintStyle(claimedBy, players) : "";
  const interactionAttrs = buildInteractionAttrs({
    interactive,
    players,
    referenceMode,
    tileId: combo.id,
  });
  const claimPanel = interactive
    ? renderClaimPanel(combo.id, players, claimedBy, activeClaimTileId)
    : "";
  const imageMarkup = showImage
    ? `
      ${renderFallback(
        combo.colors.map((color) => COLOR_LABELS[color]).join(" / "),
        combo.image.split("/").pop(),
        "Noble image missing",
      )}
      <img
        class="tile-image absolute inset-0 z-10 h-full w-full object-cover"
        alt="${escapeHtml(ariaLabel)}"
        loading="lazy"
        data-image-kind="noble"
        data-candidates='${escapeHtml(JSON.stringify(buildImageCandidates(combo.colors)))}'
        data-candidate-index="0"
      />
      <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
    `
    : `
      <div class="label-card-bg absolute inset-0 z-0"></div>
      <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
    `;

  return `
    <article
      class="card-frame noble-card noble-art-card relative isolate overflow-hidden rounded-[1.2rem] border border-white/12 bg-slate-900/70 shadow-[0_14px_32px_rgba(0,0,0,0.28)] ${claimedBy ? "is-claimed" : ""} ${isClaiming ? "is-claiming" : ""} ${isSelected ? "is-selected" : ""}"
      aria-label="${escapeHtml(ariaLabel)}"
      style="${cardStyle}"
      ${interactionAttrs}
    >
      ${imageMarkup}
      ${showReferenceBadges ? renderBadge(badgeText, "right-2 top-2 sm:right-3 sm:top-3") : ""}
      ${interactive ? renderClaimBadge(claimedBy, players) : ""}
      ${showColorChips ? renderColorChips(combo.colors) : ""}
      ${claimPanel}
    </article>
  `;
}

function renderCityCard(
  city,
  {
    activeClaimTileId = "",
    claims = {},
    interactive = false,
    players = [],
    referenceMode = "",
    selectedIds = new Set(),
  } = {},
) {
  const claimedBy = claims?.[city.id] ?? "";
  const isClaiming = interactive && activeClaimTileId === city.id;
  const isSelected = selectedIds.has(city.id);
  const interactionAttrs = buildInteractionAttrs({
    interactive,
    players,
    referenceMode,
    tileId: city.id,
  });
  const claimPanel = interactive
    ? renderClaimPanel(city.id, players, claimedBy, activeClaimTileId)
    : "";

  return `
    <article
      class="card-frame city-card relative isolate overflow-hidden rounded-[1.2rem] border border-white/12 bg-slate-900/70 shadow-[0_14px_32px_rgba(0,0,0,0.28)] ${claimedBy ? "is-claimed" : ""} ${isClaiming ? "is-claiming" : ""} ${isSelected ? "is-selected" : ""}"
      aria-label="${escapeHtml(city.title)}"
      style="${claimedBy ? claimTintStyle(claimedBy, players) : ""}"
      ${interactionAttrs}
    >
      ${renderFallback(city.title, city.filename, "City image missing")}
      <img
        class="tile-image absolute inset-0 z-10 h-full w-full object-cover"
        src="${escapeHtml(city.image)}"
        alt="${escapeHtml(city.title)}"
        loading="lazy"
        data-image-kind="static"
      />
      <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
      ${renderBadge(`City ${city.number}`, "left-2 top-2 sm:left-3 sm:top-3")}
      ${interactive ? renderClaimBadge(claimedBy, players) : ""}
      ${claimPanel}
    </article>
  `;
}

function buildInteractionAttrs({
  interactive,
  players,
  referenceMode,
  tileId,
}) {
  if (referenceMode) {
    return `data-reference-mode="${escapeHtml(referenceMode)}" data-reference-tile-id="${escapeHtml(tileId)}" role="button" tabindex="0"`;
  }

  if (interactive && players.length) {
    return `data-tile-id="${escapeHtml(tileId)}" role="button" tabindex="0"`;
  }

  return "";
}

function renderTokenCard(
  color,
  { showColorChips = true, showImage = true, showReferenceBadges = true } = {},
) {
  const ariaLabel = `${COLOR_LABELS[color]} token`;

  return `
    <article
      class="card-frame noble-card noble-art-card relative isolate overflow-hidden rounded-[1.2rem] border border-white/12 bg-slate-900/70 shadow-[0_14px_32px_rgba(0,0,0,0.28)]"
      aria-label="${escapeHtml(ariaLabel)}"
    >
      ${
        showImage
          ? `
            ${renderFallback(COLOR_LABELS[color], `${color}.webp`, "Token image missing")}
            <img
              class="tile-image absolute inset-0 z-10 h-full w-full object-cover"
              src="assets/tokens/${escapeHtml(color)}.webp"
              alt="${escapeHtml(ariaLabel)}"
              loading="lazy"
              data-image-kind="static"
            />
            <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
          `
          : `
            <div class="label-card-bg absolute inset-0 z-0"></div>
            <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
          `
      }
      ${showReferenceBadges ? renderBadge("Token", "right-2 top-2 sm:right-3 sm:top-3") : ""}
      ${showColorChips ? renderColorChips([color]) : ""}
    </article>
  `;
}

function renderBadge(text, positionClasses) {
  return `
    <span class="badge-pill absolute z-20 rounded-full border border-white/15 bg-slate-950/85 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white shadow-lg sm:text-[0.68rem] ${positionClasses}">
      ${escapeHtml(text)}
    </span>
  `;
}

function renderClaimBadge(claimedBy, players) {
  if (!claimedBy) {
    return '<span class="claim-badge hidden"></span>';
  }

  return `
    <span
      class="claim-badge absolute bottom-1/2 left-1/2 z-30 w-[84%] -translate-x-1/2 translate-y-1/2 rounded-md border px-3.5 py-2 text-[0.8rem] font-extrabold tracking-[0.04em] shadow-lg sm:text-[0.86rem]"
      style="${accentStyle(getPlayerAccent(claimedBy, players))}"
    >
      ${escapeHtml(claimedBy)}
    </span>
  `;
}

function renderColorChips(colors) {
  return `
    <div class="color-chip-stack absolute bottom-2 right-2 z-20 hidden max-w-[68%] flex-col items-end gap-1.5 sm:bottom-3 sm:right-3 md:flex">
      ${normalizeColors(colors)
        .map(
          (color) => `
            <span class="color-chip color-chip-${escapeHtml(color)} rounded-lg border border-white/15 px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-white shadow-md sm:text-[0.68rem]">
              ${escapeHtml(COLOR_LABELS[color])}
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderClaimPanel(tileId, players, claimedBy, activeClaimTileId) {
  if (!players.length || activeClaimTileId !== tileId) {
    return '<div class="claim-panel hidden"></div>';
  }

  return `
    <div class="claim-panel absolute inset-0 z-40 p-2 sm:p-3">
      <div class="claim-overlay absolute inset-0 rounded-[1.2rem] border border-white/10 backdrop-blur-xs"></div>
      <div
        class="claim-picker relative z-10 grid h-full w-full grid-cols-2 gap-2"
        style="grid-auto-rows: minmax(0, 1fr);"
      >
        ${players
          .map((player) => {
            const isActive = claimedBy === player;
            return `
              <button
                type="button"
                class="name-badge rounded-md border px-3 py-2 text-xs font-black tracking-[0.1em] shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
                style="${accentStyle(getPlayerAccent(player, players), isActive)}"
                data-claim-tile="${escapeHtml(tileId)}"
                data-claim-player="${escapeHtml(player)}"
                aria-pressed="${isActive ? "true" : "false"}"
              >
                ${escapeHtml(player)}
              </button>
            `;
          })
          .join("")}
        <button
          type="button"
          class="claim-open-button col-span-2 rounded-md border border-white/20 bg-white/88 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-950 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
          data-claim-tile="${escapeHtml(tileId)}"
          data-claim-player=""
          aria-pressed="${claimedBy ? "true" : "false"}"
        >
          ${escapeHtml("Clear")}
        </button>
      </div>
    </div>
  `;
}

function renderFallback(title, filename, message) {
  return `
    <div class="noble-fallback absolute inset-0 z-0 items-center justify-center px-4 py-6 text-center">
      <div class="space-y-2">
        <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-amber-300">${escapeHtml(message)}</p>
        <p class="text-base font-black leading-tight text-white sm:text-lg">${escapeHtml(title)}</p>
        <p class="text-xs text-slate-300 sm:text-sm">${escapeHtml(filename)}</p>
      </div>
    </div>
  `;
}

function getPlayerAccent(player, players = []) {
  const index = players.findIndex((entry) => entry === player);
  return PLAYER_ACCENTS[index === -1 ? 0 : index % PLAYER_ACCENTS.length];
}

function accentStyle(accent, active = true) {
  if (!accent) {
    return "";
  }

  if (active) {
    return `background:${accent.fill};border-color:${accent.strong};color:${accent.text};`;
  }

  return `background:${accent.soft};border-color:${accent.strong};color:${accent.text};`;
}

function claimTintStyle(claimedBy, players) {
  const accent = getPlayerAccent(claimedBy, players);

  if (!accent) {
    return "";
  }

  return `--claim-fill:${accent.soft};`;
}

function wireImageFallback(root) {
  root.querySelectorAll('[data-image-kind="noble"]').forEach((image) => {
    loadNobleCandidate(image);
    image.addEventListener("error", onNobleImageError);
  });
}

function wireStaticImageFallback(root) {
  root.querySelectorAll('[data-image-kind="static"]').forEach((image) => {
    image.addEventListener("error", () => {
      image.closest(".card-frame")?.classList.add("is-missing");
      image.remove();
    });
  });
}

function onNobleImageError(event) {
  const image = event.currentTarget;
  const currentIndex = Number.parseInt(image.dataset.candidateIndex ?? "0", 10);
  image.dataset.candidateIndex = String(currentIndex + 1);
  loadNobleCandidate(image);
}

function loadNobleCandidate(image) {
  const candidates = JSON.parse(image.dataset.candidates ?? "[]");
  const candidateIndex = Number.parseInt(
    image.dataset.candidateIndex ?? "0",
    10,
  );
  const nextCandidate = candidates[candidateIndex];

  if (!nextCandidate) {
    image.closest(".card-frame")?.classList.add("is-missing");
    image.remove();
    return;
  }

  image.src = nextCandidate;
}
