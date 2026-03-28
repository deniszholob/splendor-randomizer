import {
  COLOR_LABELS,
  COLORS,
  GITHUB_LINK,
  PLAYER_ACCENTS,
} from "./constants.data.js";
import {
  buildImageCandidates,
  comboId,
  normalizeColors,
} from "./tiles.util.js";
import { escapeHtml } from "./shared.util.js";

export function createRenderer(elements) {
  elements.sourceLink.href = GITHUB_LINK;

  return {
    renderApp({ pools, state, activeClaimTileId }) {
      document.title = "Splendor Randomizer";
      syncControls(elements, pools, state);
      elements.modeDescription.textContent = `Generate a random set of ${state.mode}, share the URL so everyone sees the same tiles, then mark claimed tiles by player as the game moves.`;
      elements.playerSummary.innerHTML = renderPlayerSummary(state);
      elements.playerSummary.classList.toggle(
        "hidden",
        state.players.length === 0,
      );
      elements.results.className =
        state.mode === "cities"
          ? "result-board result-board-cities"
          : "result-board";
      elements.results.innerHTML = renderSelection(state, activeClaimTileId);
      wireImageFallback(elements.results);
    },

    renderReference(pools) {
      elements.nobleReference.innerHTML = renderNobleReference(pools);
      elements.cityReference.innerHTML = renderCityReference(pools.cityPool);
      wireImageFallback(elements.nobleReference);
      wireStaticImageFallback(elements.cityReference);
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

function syncControls(elements, pools, state) {
  const maxCount =
    state.mode === "cities" ? pools.cityPool.length : pools.noblePool.length;

  elements.modeInputs.forEach((input) => {
    input.checked = input.value === state.mode;
  });
  elements.countInput.max = String(maxCount);
  elements.countInput.value = String(state.count);
  elements.countHint.textContent = `max ${maxCount}`;
  elements.playersInput.value = state.players.join(" ");
}

function renderSelection(state, activeClaimTileId) {
  return state.selection
    .map((item) => {
      return item.kind === "cities"
        ? renderCityCard(item, state, activeClaimTileId, true)
        : renderNobleCard(item, state, activeClaimTileId, true);
    })
    .join("");
}

function renderPlayerSummary(state) {
  const counts = new Map(state.players.map((player) => [player, 0]));

  for (const claimedBy of Object.values(state.claims ?? {})) {
    counts.set(claimedBy, (counts.get(claimedBy) ?? 0) + 1);
  }

  return state.players
    .map((player) => {
      const accent = getPlayerAccent(player, state.players);
      const claimedCount = counts.get(player) ?? 0;
      return `
        <div
          class="rounded-full border px-3 py-1.5 text-sm font-bold"
          style="${accentStyle(accent)}"
        >
          ${escapeHtml(`${player} ${claimedCount > 0 ? `(${claimedCount})` : ""}`.trim())}
        </div>
      `;
    })
    .join("");
}

function renderNobleReference(pools) {
  const cards = [];
  const { nobleById } = pools;

  for (let rowIndex = 0; rowIndex < COLORS.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < COLORS.length; columnIndex += 1) {
      const rowColor = COLORS[rowIndex];
      const columnColor = COLORS[columnIndex];

      if (rowIndex === columnIndex) {
        cards.push(renderTokenCard(rowColor));
        continue;
      }

      if (columnIndex < rowIndex) {
        const pairColors = normalizeColors([rowColor, columnColor]);
        const pair = nobleById.get(comboId(pairColors));
        if (pair) {
          cards.push(renderNobleCard(pair));
        }
        continue;
      }

      const tripletColors = COLORS.filter(
        (color) => color !== rowColor && color !== columnColor,
      );
      const triplet = nobleById.get(comboId(tripletColors));
      if (triplet) {
        cards.push(renderNobleCard(triplet));
      }
    }
  }

  return cards.join("");
}

function renderCityReference(cityPool) {
  return cityPool.map((city) => renderCityCard(city)).join("");
}

function renderNobleCard(
  combo,
  state = null,
  activeClaimTileId = "",
  interactive = false,
) {
  // Cards render to strings so one board-level `innerHTML` update can replace
  // the full grid while events stay delegated at the container level.
  const badgeText = combo.colors.length === 2 ? "Double" : "Triplet";
  const ariaLabel = `Noble for ${combo.colors.map((color) => COLOR_LABELS[color]).join(", ")}`;
  const claimedBy = state?.claims?.[combo.id] ?? "";
  const isClaiming = interactive && activeClaimTileId === combo.id;
  const interactiveAttrs =
    interactive && state?.players?.length
      ? ` data-tile-id="${escapeHtml(combo.id)}" role="button" tabindex="0"`
      : "";
  const claimPanel = interactive
    ? renderClaimPanel(combo.id, state, claimedBy, activeClaimTileId)
    : "";

  return `
    <article
      class="card-frame noble-card relative isolate overflow-hidden rounded-[1.2rem] border border-white/12 bg-slate-900/70 shadow-[0_14px_32px_rgba(0,0,0,0.28)] ${claimedBy ? "is-claimed" : ""} ${isClaiming ? "is-claiming" : ""} noble-art-card"
      aria-label="${escapeHtml(ariaLabel)}"
      ${interactiveAttrs}
    >
      ${renderFallback(
        combo.colors.map((color) => COLOR_LABELS[color]).join(" / "),
        combo.image.split("/").pop(),
        "Noble image missing",
      )}
      <img
        class="absolute inset-0 z-10 h-full w-full object-cover"
        alt="${escapeHtml(ariaLabel)}"
        loading="lazy"
        data-image-kind="noble"
        data-candidates='${escapeHtml(JSON.stringify(buildImageCandidates(combo.colors)))}'
        data-candidate-index="0"
      />
      <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
      ${renderBadge(badgeText, "right-2 top-2 sm:right-3 sm:top-3")}
      ${renderClaimBadge(claimedBy, state?.players ?? [])}
      ${renderColorChips(combo.colors)}
      ${claimPanel}
    </article>
  `;
}

function renderCityCard(
  city,
  state = null,
  activeClaimTileId = "",
  interactive = false,
) {
  const claimedBy = state?.claims?.[city.id] ?? "";
  const isClaiming = interactive && activeClaimTileId === city.id;
  const interactiveAttrs =
    interactive && state?.players?.length
      ? ` data-tile-id="${escapeHtml(city.id)}" role="button" tabindex="0"`
      : "";
  const claimPanel = interactive
    ? renderClaimPanel(city.id, state, claimedBy, activeClaimTileId)
    : "";

  return `
    <article
      class="card-frame city-card relative isolate overflow-hidden rounded-[1.2rem] border border-white/12 bg-slate-900/70 shadow-[0_14px_32px_rgba(0,0,0,0.28)] ${claimedBy ? "is-claimed" : ""} ${isClaiming ? "is-claiming" : ""}"
      aria-label="${escapeHtml(city.title)}"
      ${interactiveAttrs}
    >
      ${renderFallback(city.title, city.filename, "City image missing")}
      <img
        class="absolute inset-0 z-10 h-full w-full object-cover"
        src="${escapeHtml(city.image)}"
        alt="${escapeHtml(city.title)}"
        loading="lazy"
        data-image-kind="static"
      />
      <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
      ${renderBadge(`City ${city.number}`, "left-2 top-2 sm:left-3 sm:top-3")}
      ${renderClaimBadge(claimedBy, state?.players ?? [])}
      ${claimPanel}
    </article>
  `;
}

function renderTokenCard(color) {
  return `
    <article
      class="card-frame noble-card noble-art-card relative isolate overflow-hidden rounded-[1.2rem] border border-white/12 bg-slate-900/70 shadow-[0_14px_32px_rgba(0,0,0,0.28)]"
      aria-label="${escapeHtml(`${COLOR_LABELS[color]} token`)}"
    >
      ${renderFallback(COLOR_LABELS[color], `${color}.webp`, "Token image missing")}
      <img
        class="absolute inset-0 z-10 h-full w-full object-cover"
        src="assets/tokens/${escapeHtml(color)}.webp"
        alt="${escapeHtml(`${COLOR_LABELS[color]} token`)}"
        loading="lazy"
        data-image-kind="static"
      />
      <div class="card-scrim pointer-events-none absolute inset-0 z-10"></div>
      ${renderBadge("Token", "right-2 top-2 sm:right-3 sm:top-3")}
      ${renderColorChips([color])}
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
      class="claim-badge absolute left-2 bottom-2 z-30 max-w-[70%] rounded-full border px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.16em] shadow-lg sm:left-3 sm:bottom-3 sm:text-[0.68rem]"
      style="${accentStyle(getPlayerAccent(claimedBy, players))}"
    >
      ${escapeHtml(claimedBy)}
    </span>
  `;
}

function renderColorChips(colors) {
  return `
    <div class="color-chip-stack absolute bottom-2 right-2 z-20 hidden max-w-[42%] flex-col items-end gap-1.5 sm:bottom-3 sm:right-3 md:flex">
      ${normalizeColors(colors)
        .map(
          (color) => `
            <span class="color-chip color-chip-${escapeHtml(color)} rounded-full border border-white/15 px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-white shadow-md sm:text-[0.68rem]">
              ${escapeHtml(COLOR_LABELS[color])}
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderClaimPanel(tileId, state, claimedBy, activeClaimTileId) {
  if (!state?.players?.length || activeClaimTileId !== tileId) {
    return '<div class="claim-panel hidden"></div>';
  }

  // Keep the claim picker compact while scaling up to the max player count.
  const columnCount = Math.min(
    3,
    Math.max(2, Math.ceil(Math.sqrt(state.players.length + 1))),
  );

  return `
    <div class="claim-panel absolute inset-0 z-40 p-2 sm:p-3">
      <div class="claim-overlay absolute inset-0 rounded-[1.2rem] border border-white/18 bg-slate-950/88 backdrop-blur-sm"></div>
      <div
        class="claim-picker relative z-10 grid h-full w-full gap-2"
        style="grid-template-columns: repeat(${columnCount}, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr);"
      >
        <button
          type="button"
          class="rounded-full border border-white/18 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-[10px] ${claimedBy ? "bg-slate-950/88 text-white" : "bg-amber-300 text-slate-900"}"
          data-claim-tile="${escapeHtml(tileId)}"
          data-claim-player=""
          aria-pressed="${claimedBy ? "false" : "true"}"
        >
          Open
        </button>
        ${state.players
          .map((player) => {
            const isActive = claimedBy === player;
            return `
              <button
                type="button"
                class="rounded-full border px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                style="${accentStyle(getPlayerAccent(player, state.players), isActive)}"
                data-claim-tile="${escapeHtml(tileId)}"
                data-claim-player="${escapeHtml(player)}"
                aria-pressed="${isActive ? "true" : "false"}"
              >
                ${escapeHtml(player)}
              </button>
            `;
          })
          .join("")}
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

  return `background:${accent.soft};border-color:${accent.strong};color:white;`;
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
  // Noble art asset names vary, so we try the ordered candidate list until one
  // loads or fall back to the placeholder card.
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
