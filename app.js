const GITHUB_LINK = `https://github.com/deniszholob/splendor-randomizer`;
const COLORS = ["white", "red", "green", "blue", "black"];
const COLOR_LABELS = {
  white: "White",
  red: "Red",
  green: "Green",
  blue: "Blue",
  black: "Black",
};
const CITY_IMAGES = new Set([
  "city-11.webp",
  "city-12.webp",
  "city-13.webp",
  "city-21.webp",
  "city-22.webp",
  "city-23.webp",
  "city-31.webp",
  "city-32.webp",
  "city-33.webp",
  "city-41.webp",
  "city-42.webp",
  "city-43.webp",
  "city-51.webp",
  "city-52.webp",
  "city-53.webp",
]);
const EXISTING_NOBLE_IMAGES = new Set([
  "black-blue-green.webp",
  "black-blue-white.webp",
  "black-green.webp",
  "black-red-blue.webp",
  "black-red-green.webp",
  "black-red-white.webp",
  "black-red.webp",
  "black-white-green.webp",
  "black-white.webp",
  "blue-black.webp",
  "blue-green.webp",
  "blue-red.webp",
  "blue-white-2.webp",
  "blue-white-red.webp",
  "blue-white.webp",
  "green-black.webp",
  "green-blue-red.webp",
  "green-blue-white.webp",
  "red-green-white.webp",
  "red-green.webp",
  "red-white.webp",
  "white-green.webp",
]);

const root = document.getElementById("app");

let noblePool = [];
let cityPool = [];
let referenceSectionOpen = false;
let pendingFocus = null;
let wakeLockHandle = null;

void init();

async function init() {
  try {
    const response = await fetch("./combos.json");
    if (!response.ok) {
      throw new Error(`Could not load combos.json (${response.status})`);
    }

    const combos = await response.json();
    noblePool = buildNoblePool(combos);
    cityPool = buildCityPool();

    window.addEventListener("hashchange", renderFromHash);

    if (!window.location.hash) {
      commitState(generateRandomState("nobles", 3));
      return;
    }

    renderFromHash();
  } catch (error) {
    renderError(error);
  }
}

function buildNoblePool(combos) {
  return [...combos.pairs, ...combos.triplets].map((item) => {
    const colors = normalizeColors(item.colors);
    return {
      ...item,
      kind: "nobles",
      id: comboId(colors),
      colors,
      image: buildImagePath(colors),
    };
  });
}

function buildCityPool() {
  return [...CITY_IMAGES]
    .map((filename) => {
      return {
        kind: "cities",
        id: filename.replace(".webp", ""),
        filename,
        image: `assets/cities/${filename}`,
        title: filename.replace(".webp", "").replaceAll("-", " "),
      };
    })
    .sort((left, right) => {
      const leftPosition = getCityPosition(left.filename);
      const rightPosition = getCityPosition(right.filename);

      if (leftPosition.row !== rightPosition.row) {
        return leftPosition.row - rightPosition.row;
      }

      if (leftPosition.column !== rightPosition.column) {
        return leftPosition.column - rightPosition.column;
      }

      return left.filename.localeCompare(right.filename);
    });
}

function getCityPosition(filename) {
  const match = filename.match(/^city-(\d)(\d)/);

  if (!match) {
    return { row: Number.POSITIVE_INFINITY, column: Number.POSITIVE_INFINITY };
  }

  return {
    row: Number.parseInt(match[1], 10),
    column: Number.parseInt(match[2], 10),
  };
}

function normalizeColors(colors) {
  return [...colors].sort(
    (left, right) => COLORS.indexOf(left) - COLORS.indexOf(right),
  );
}

function comboId(colors) {
  return colors.join("-");
}

function buildImagePath(colors) {
  return `assets/nobles/${comboId(colors)}.webp`;
}

function getPool(mode) {
  return mode === "cities" ? cityPool : noblePool;
}

function getMaxCount(mode) {
  return getPool(mode).length;
}

function parseHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const rawMode = params.get("mode");
  const mode = rawMode === "cities" ? "cities" : "nobles";
  const maxCount = getMaxCount(mode);
  const rawCount = Number.parseInt(params.get("count") ?? "3", 10);
  const count = Number.isFinite(rawCount)
    ? clamp(rawCount, 1, Math.max(maxCount, 1))
    : clamp(3, 1, Math.max(maxCount, 1));
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return { mode, count, ids };
}

function sanitizeState(state) {
  const pool = getPool(state.mode);
  const availableIds = new Set(pool.map((item) => item.id));
  const ids = [...new Set(state.ids)]
    .filter((id) => availableIds.has(id))
    .slice(0, state.count);

  if (ids.length === state.count) {
    return { ...state, ids };
  }

  return generateRandomState(state.mode, state.count);
}

function generateRandomState(mode, count) {
  const pool = [...getPool(mode)];
  shuffle(pool);

  return {
    mode,
    count: clamp(count, 1, getMaxCount(mode)),
    ids: pool
      .slice(0, clamp(count, 1, getMaxCount(mode)))
      .map((item) => item.id),
  };
}

function commitState(state, replace = false) {
  const normalized = sanitizeState(state);
  const params = new URLSearchParams();
  params.set("mode", normalized.mode);
  params.set("count", String(normalized.count));
  params.set("ids", normalized.ids.join(","));
  const nextHash = `#${params.toString()}`;

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
  commitState(sanitizeState(parseHash()), true);
}

function renderState(state) {
  document.title = "Splendor Randomizer";

  const selection = state.ids
    .map((id) => getPool(state.mode).find((item) => item.id === id))
    .filter(Boolean);

  const page = document.createElement("main");
  page.className =
    "mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col px-3 py-4 text-white sm:px-4 lg:px-6";

  page.append(
    createHeader(state),
    createControls(state),
    createResults(state, selection),
    createReferenceSection(),
    createFooter(),
  );

  root.replaceChildren(page);
  restorePendingFocus();
}

function createHeader(state) {
  const header = document.createElement("header");
  header.className = "mb-4 text-center sm:mb-5";
  header.innerHTML = `
    <p class="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Splendor Randomizer</p>
    <p class="mx-auto mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
      Generate a random set of ${state.mode}, then share the URL so everyone sees the exact same tiles.
    </p>
  `;
  return header;
}

function createControls(state) {
  const section = document.createElement("section");
  section.className =
    "mb-4 rounded-lg border border-white/12 bg-slate-950/45 p-2.5 shadow-[0_14px_38px_rgba(0,0,0,0.22)] backdrop-blur-sm sm:mb-5 sm:p-3";

  const form = document.createElement("form");
  form.className = "flex flex-col gap-2";

  const modeField = document.createElement("fieldset");
  modeField.className = "space-y-3";
  modeField.innerHTML = `
    <legend class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Tile Type</legend>
    <div class="grid grid-cols-2 gap-2">
      <label class="mode-option">
        <input class="sr-only" type="radio" name="mode" value="nobles" ${state.mode === "nobles" ? "checked" : ""} />
        <span>Nobles</span>
      </label>
      <label class="mode-option">
        <input class="sr-only" type="radio" name="mode" value="cities" ${state.mode === "cities" ? "checked" : ""} />
        <span>Cities</span>
      </label>
    </div>
  `;

  const countField = document.createElement("label");
  countField.className = "block";
  countField.innerHTML = `
    <span class="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
      <span>Tile Count</span>
      <span class="count-hint text-[0.7rem] normal-case tracking-normal text-slate-400">max ${getMaxCount(state.mode)}</span>
    </span>
    <input
      class="w-full rounded-xl border border-white/12 bg-slate-900/90 px-3 py-2 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300"
      type="number"
      name="count"
      min="1"
      max="${getMaxCount(state.mode)}"
      value="${state.count}"
      inputmode="numeric"
    />
  `;

  const shareButton = document.createElement("button");
  shareButton.className =
    "rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/12";
  shareButton.type = "button";
  shareButton.textContent = "Share";
  shareButton.addEventListener("click", async () => {
    await shareCurrentSelection();
    shareButton.textContent = "Shared";
    window.setTimeout(() => {
      shareButton.textContent = "Share";
    }, 1400);
  });

  const rerollButton = document.createElement("button");
  rerollButton.className =
    "rounded-xl bg-amber-300 px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200";
  rerollButton.type = "button";
  rerollButton.textContent = "Reroll";
  rerollButton.addEventListener("click", () => {
    const selectedMode =
      form.querySelector('input[name="mode"]:checked')?.value === "cities"
        ? "cities"
        : "nobles";
    const nextCount = clamp(
      Number.parseInt(countInput.value, 10) || 1,
      1,
      getMaxCount(selectedMode),
    );
    commitState(generateRandomState(selectedMode, nextCount));
  });

  const modeInputs = [...modeField.querySelectorAll('input[name="mode"]')];
  const countInput = countField.querySelector('input[name="count"]');
  const countHint = countField.querySelector(".count-hint");
  const actionRow = document.createElement("div");
  actionRow.className = "grid grid-cols-2 gap-2";

  const preserveCountFocus = () => {
    pendingFocus = {
      selector: 'input[name="count"]',
      start: countInput.selectionStart,
      end: countInput.selectionEnd,
    };
  };

  const commitFromForm = () => {
    const selectedMode =
      form.querySelector('input[name="mode"]:checked')?.value === "cities"
        ? "cities"
        : "nobles";
    const nextCount = clamp(
      Number.parseInt(countInput.value, 10) || 1,
      1,
      getMaxCount(selectedMode),
    );

    countInput.max = String(getMaxCount(selectedMode));
    countInput.value = String(nextCount);
    countHint.textContent = `max ${getMaxCount(selectedMode)}`;
    commitState(generateRandomState(selectedMode, nextCount));
  };

  for (const input of modeInputs) {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }

      const nextMax = getMaxCount(input.value);
      countInput.max = String(nextMax);
      countInput.value = String(
        clamp(Number.parseInt(countInput.value, 10) || 1, 1, nextMax),
      );
      countHint.textContent = `max ${nextMax}`;
      preserveCountFocus();
      commitFromForm();
    });
  }

  countInput.addEventListener("input", () => {
    const selectedMode =
      form.querySelector('input[name="mode"]:checked')?.value === "cities"
        ? "cities"
        : "nobles";
    const nextCount = clamp(
      Number.parseInt(countInput.value, 10) || 1,
      1,
      getMaxCount(selectedMode),
    );
    countHint.textContent = `max ${getMaxCount(selectedMode)}`;
    preserveCountFocus();
    commitState(generateRandomState(selectedMode, nextCount));
  });

  actionRow.append(rerollButton, shareButton);
  form.append(modeField, countField, actionRow);
  section.append(form);
  return section;
}

function createResults(state, selection) {
  const section = document.createElement("section");
  section.className = "flex-1";

  const resultHeader = document.createElement("div");
  resultHeader.className =
    "mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between";
  const headingBlock = document.createElement("div");
  headingBlock.innerHTML = `
    <div>
      <p class="text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Result</p>
      <h2 class="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
        ${selection.length} Random ${state.mode === "cities" ? "Cities" : "Nobles"}
      </h2>
    </div>
  `;

  const fullscreenButton = document.createElement("button");
  fullscreenButton.className =
    "self-start rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/12 sm:self-auto";
  fullscreenButton.type = "button";
  fullscreenButton.textContent = "Fullscreen";
  fullscreenButton.addEventListener("click", toggleFullscreenMode);

  resultHeader.append(headingBlock, fullscreenButton);

  const grid = document.createElement("div");
  grid.className =
    state.mode === "cities"
      ? "result-board result-board-cities"
      : "result-board";

  for (const item of selection) {
    grid.append(
      item.kind === "cities"
        ? createCityCard(item.filename)
        : createNobleCard(item),
    );
  }

  section.append(resultHeader, grid);
  return section;
}

function createReferenceSection() {
  const section = document.createElement("details");
  section.className =
    "mt-8 rounded-[1.5rem] border border-white/12 bg-slate-950/35 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-sm";
  section.open = referenceSectionOpen;
  section.addEventListener("toggle", () => {
    referenceSectionOpen = section.open;
  });

  const summary = document.createElement("summary");
  summary.className =
    "cursor-pointer list-none text-center text-sm font-black uppercase tracking-[0.22em] text-slate-200";
  summary.textContent = "Reference Grids";

  const body = document.createElement("div");
  body.className = "mt-5 space-y-8";

  const nobleSection = document.createElement("section");
  nobleSection.innerHTML = `
    <div class="mb-4 text-center">
      <p class="text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Reference</p>
      <h2 class="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">All Nobles <span class="text-slate-400">(${noblePool.length})</span></h2>
    </div>
  `;

  const nobleBoard = document.createElement("section");
  nobleBoard.className = "noble-board";
  nobleBoard.setAttribute("aria-label", "All noble tiles");

  for (let rowIndex = 0; rowIndex < COLORS.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < COLORS.length; columnIndex += 1) {
      const rowColor = COLORS[rowIndex];
      const columnColor = COLORS[columnIndex];

      if (rowIndex === columnIndex) {
        nobleBoard.append(createTokenCard(rowColor));
        continue;
      }

      if (columnIndex < rowIndex) {
        const pairColors = normalizeColors([rowColor, columnColor]);
        const pair = noblePool.find((item) => item.id === comboId(pairColors));
        if (pair) {
          nobleBoard.append(createNobleCard(pair));
        }
        continue;
      }

      const tripletColors = COLORS.filter(
        (color) => color !== rowColor && color !== columnColor,
      );
      const triplet = noblePool.find(
        (item) => item.id === comboId(tripletColors),
      );
      if (triplet) {
        nobleBoard.append(createNobleCard(triplet));
      }
    }
  }

  nobleSection.append(nobleBoard);

  const citySection = document.createElement("section");
  citySection.innerHTML = `
    <div class="mb-4 text-center">
      <p class="text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Reference</p>
      <h2 class="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">All Cities <span class="text-slate-400">(${cityPool.length})</span></h2>
    </div>
  `;

  const cityBoard = document.createElement("section");
  cityBoard.className = "city-board";
  cityBoard.setAttribute("aria-label", "All city tiles");

  for (const city of cityPool) {
    cityBoard.append(createCityCard(city.filename));
  }

  citySection.append(cityBoard);
  body.append(nobleSection, citySection);
  section.append(summary, body);
  return section;
}

function createFooter() {
  const footer = document.createElement("footer");
  footer.className = "mt-6 text-center text-sm text-slate-300";
  footer.innerHTML = `
    <a class="font-semibold text-amber-300 transition hover:text-amber-200" href="${GITHUB_LINK}" target="_blank" rel="noreferrer">View source</a>
  `;
  return footer;
}

function createNobleCard(combo) {
  const badgeText = combo.colors.length === 2 ? "Double" : "Triplet";
  const ariaLabel = `Noble for ${combo.colors.map((color) => COLOR_LABELS[color]).join(", ")}`;
  const card = document.createElement("article");
  card.className = "card-frame noble-card";
  card.setAttribute("aria-label", ariaLabel);

  const fallback = createFallbackContent(
    combo.colors.map((color) => COLOR_LABELS[color]).join(" / "),
    combo.image.split("/").pop(),
    "Noble image missing",
  );

  const image = document.createElement("img");
  image.className = "absolute inset-0 z-10 h-full w-full object-cover";
  image.alt = ariaLabel;
  image.loading = "lazy";
  image.dataset.candidates = JSON.stringify(buildImageCandidates(combo.colors));
  image.dataset.candidateIndex = "0";
  image.addEventListener("error", handleImageError);
  loadCandidate(image);

  const scrim = document.createElement("div");
  scrim.className = "card-scrim";

  card.append(
    fallback,
    image,
    scrim,
    createBadge(badgeText),
    createChipRow(combo.colors),
  );
  card.classList.add("noble-art-card");
  return card;
}

function createCityCard(filename) {
  const title = filename.replace(".webp", "").replaceAll("-", " ");
  const card = document.createElement("article");
  card.className = "card-frame city-card";
  card.setAttribute("aria-label", title);

  const fallback = createFallbackContent(title, filename, "City image missing");

  const image = document.createElement("img");
  image.className = "absolute inset-0 z-10 h-full w-full object-cover";
  image.src = `assets/cities/${filename}`;
  image.alt = title;
  image.loading = "lazy";

  const scrim = document.createElement("div");
  scrim.className = "card-scrim";

  image.addEventListener("error", () => {
    card.classList.add("is-missing");
    image.remove();
  });

  card.append(fallback, image, scrim, createLeftBadge("City"));
  return card;
}

function createTokenCard(color) {
  const card = document.createElement("article");
  card.className = "card-frame noble-card";
  card.setAttribute("aria-label", `${COLOR_LABELS[color]} token`);

  const fallback = createFallbackContent(
    COLOR_LABELS[color],
    `${color}.webp`,
    "Token image missing",
  );

  const image = document.createElement("img");
  image.className = "absolute inset-0 z-10 h-full w-full object-cover";
  image.src = `assets/tokens/${color}.webp`;
  image.alt = `${COLOR_LABELS[color]} token`;
  image.loading = "lazy";

  const scrim = document.createElement("div");
  scrim.className = "card-scrim";

  image.addEventListener("error", () => {
    card.classList.add("is-missing");
    image.remove();
  });

  card.append(
    fallback,
    image,
    scrim,
    createBadge("Token"),
    createChipRow([color]),
  );
  card.classList.add("noble-art-card");
  return card;
}

function createBadge(text) {
  const badge = document.createElement("span");
  badge.className =
    "badge-pill absolute right-2 top-2 z-20 rounded-full border border-white/15 bg-slate-950/85 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white shadow-lg sm:right-3 sm:top-3 sm:text-[0.68rem]";
  badge.textContent = text;
  return badge;
}

function createLeftBadge(text) {
  const badge = document.createElement("span");
  badge.className =
    "badge-pill absolute left-2 top-2 z-20 rounded-full border border-white/15 bg-slate-950/85 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white shadow-lg sm:left-3 sm:top-3 sm:text-[0.68rem]";
  badge.textContent = text;
  return badge;
}

function createChipRow(colors) {
  const row = document.createElement("div");
  row.className =
    "color-chip-stack absolute bottom-2 right-2 z-20 hidden max-w-[42%] flex-col items-end gap-1.5 sm:bottom-3 sm:right-3 md:flex";

  for (const color of normalizeColors(colors)) {
    const chip = document.createElement("span");
    chip.className = `color-chip color-chip-${color}`;
    chip.textContent = COLOR_LABELS[color];
    row.append(chip);
  }

  return row;
}

function createFallbackContent(title, filename, message) {
  const fallback = document.createElement("div");
  fallback.className =
    "noble-fallback absolute inset-0 z-0 flex items-center justify-center px-4 py-6 text-center";
  fallback.innerHTML = `
    <div class="space-y-2">
      <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-amber-300">${message}</p>
      <p class="text-base font-black leading-tight text-white sm:text-lg">${title}</p>
      <p class="text-xs text-slate-300 sm:text-sm">${filename}</p>
    </div>
  `;
  return fallback;
}

function buildImageCandidates(colors) {
  const candidates = new Set();

  for (const permutation of getPermutations(colors)) {
    const baseName = `${comboId(permutation)}.webp`;
    const altName = `${comboId(permutation)}-2.webp`;

    if (EXISTING_NOBLE_IMAGES.has(baseName)) {
      candidates.add(`assets/nobles/${baseName}`);
    }

    if (EXISTING_NOBLE_IMAGES.has(altName)) {
      candidates.add(`assets/nobles/${altName}`);
    }
  }

  return [...candidates];
}

function getPermutations(colors) {
  if (colors.length <= 1) {
    return [colors];
  }

  const permutations = [];

  for (let index = 0; index < colors.length; index += 1) {
    const current = colors[index];
    const remaining = colors.filter((_, itemIndex) => itemIndex !== index);

    for (const permutation of getPermutations(remaining)) {
      permutations.push([current, ...permutation]);
    }
  }

  return permutations;
}

function loadCandidate(image) {
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

function handleImageError(event) {
  const image = event.currentTarget;
  const currentIndex = Number.parseInt(image.dataset.candidateIndex ?? "0", 10);
  image.dataset.candidateIndex = String(currentIndex + 1);
  loadCandidate(image);
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function renderError(error) {
  document.title = "Splendor Randomizer";

  const panel = document.createElement("main");
  panel.className =
    "mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4 py-8";
  panel.innerHTML = `
    <section class="w-full rounded-[2rem] border border-white/12 bg-slate-950/60 p-8 text-center shadow-[0_18px_55px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p class="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Splendor Randomizer</p>
      <h1 class="text-3xl font-black tracking-tight text-white sm:text-4xl">Could not load tiles</h1>
      <p class="mt-3 text-slate-300">${error instanceof Error ? error.message : "Unknown error"}</p>
    </section>
  `;

  root.replaceChildren(panel);
}

function restorePendingFocus() {
  if (!pendingFocus) {
    return;
  }

  const target = root.querySelector(pendingFocus.selector);
  if (!(target instanceof HTMLInputElement)) {
    pendingFocus = null;
    return;
  }

  target.focus();
  if (
    typeof pendingFocus.start === "number" &&
    typeof pendingFocus.end === "number"
  ) {
    target.setSelectionRange(pendingFocus.start, pendingFocus.end);
  }
  pendingFocus = null;
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
  if (!("wakeLock" in navigator) || wakeLockHandle) {
    return;
  }

  try {
    wakeLockHandle = await navigator.wakeLock.request("screen");
    wakeLockHandle.addEventListener("release", () => {
      wakeLockHandle = null;
    });
  } catch (_error) {
    wakeLockHandle = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLockHandle) {
    return;
  }

  await wakeLockHandle.release();
  wakeLockHandle = null;
}
