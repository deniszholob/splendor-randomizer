const GITHUB_LINK = `https://github.com/deniszholob/splendor-randomizer`;
const COLORS = ["white", "red", "green", "blue", "black"];
const COLOR_LABELS = {
  white: "White",
  red: "Red",
  green: "Green",
  blue: "Blue",
  black: "Black",
};
const CITY_IMAGES = [
  "city-11.webp",
  "city-12.webp",
  "city-13.webp",
  "city-14.webp",
  "city-15.webp",
  "city-21.webp",
  "city-22.webp",
  "city-23.webp",
  "city-24.webp",
  "city-25.webp",
  "city-31.webp",
  "city-32.webp",
  "city-33.webp",
  "city-35.webp",
  "city-35-2.webp",
];

const root = document.getElementById("app");

void init();

async function init() {
  try {
    const response = await fetch("./combos.json");
    if (!response.ok) {
      throw new Error(`Could not load combos.json (${response.status})`);
    }

    const combos = await response.json();
    renderPage(createLookup(combos.pairs), createLookup(combos.triplets));
  } catch (error) {
    renderError(error);
  }
}

function createLookup(items) {
  return new Map(
    items.map((item) => {
      const colors = normalizeColors(item.colors);
      return [
        comboId(colors),
        {
          ...item,
          id: comboId(colors),
          colors,
          image: buildImagePath(colors),
        },
      ];
    }),
  );
}

function normalizeColors(colors) {
  return [...colors].sort((left, right) => COLORS.indexOf(left) - COLORS.indexOf(right));
}

function comboId(colors) {
  return colors.join("-");
}

function buildImagePath(colors) {
  return `assets/nobles/${comboId(colors)}.webp`;
}

function renderPage(pairs, triplets) {
  document.title = "Splendor Noble And City Grid";

  const page = document.createElement("main");
  page.className =
    "mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col px-3 py-3 text-white sm:px-4 sm:py-4 lg:px-6 lg:py-5";

  page.innerHTML = `
    <header class="mb-4 shrink-0 text-center lg:mb-5">
      <p class="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Splendor Randomizer</p>
      <h1 class="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Nobles And Cities</h1>
      <p class="mx-auto mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
        Doubles sit to the left of the diagonal, triplets sit to the right, the tokens run down the diagonal, and all city cards are shown below.
      </p>
    </header>
  `;

  const board = document.createElement("section");
  board.className = "noble-board flex-1";
  board.setAttribute("aria-label", "Splendor noble layout");

  for (let rowIndex = 0; rowIndex < COLORS.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < COLORS.length; columnIndex += 1) {
      const rowColor = COLORS[rowIndex];
      const columnColor = COLORS[columnIndex];

      if (rowIndex === columnIndex) {
        board.append(createTokenCard(rowColor));
        continue;
      }

      if (columnIndex < rowIndex) {
        const pairColors = normalizeColors([rowColor, columnColor]);
        board.append(
          createNobleCard(
            pairs.get(comboId(pairColors)),
            "Double",
            `Double noble for ${pairColors.map((color) => COLOR_LABELS[color]).join(" and ")}`,
          ),
        );
        continue;
      }

      const tripletColors = COLORS.filter((color) => color !== rowColor && color !== columnColor);
      board.append(
        createNobleCard(
          triplets.get(comboId(tripletColors)),
          "Triplet",
          `Triplet noble for ${tripletColors.map((color) => COLOR_LABELS[color]).join(", ")}`,
        ),
      );
    }
  }

  const footer = document.createElement("footer");
  footer.className = "mt-4 shrink-0 text-center text-sm text-slate-300";
  footer.innerHTML = `
    <a class="font-semibold text-amber-300 transition hover:text-amber-200" href="${GITHUB_LINK}" target="_blank" rel="noreferrer">View source</a>
  `;

  page.append(board, createCitiesSection(), footer);
  root.replaceChildren(page);
}

function createCitiesSection() {
  const section = document.createElement("section");
  section.className = "mt-6";
  section.setAttribute("aria-label", "Splendor city grid");

  const heading = document.createElement("div");
  heading.className = "mb-4 text-center";
  heading.innerHTML = `
    <p class="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Expansion</p>
    <h2 class="text-2xl font-black tracking-tight text-white sm:text-3xl">All Cities</h2>
  `;

  const grid = document.createElement("section");
  grid.className = "city-board";

  for (const filename of CITY_IMAGES) {
    grid.append(createCityCard(filename));
  }

  section.append(heading, grid);
  return section;
}

function createTokenCard(color) {
  const card = document.createElement("article");
  card.className = "card-frame";
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

  const badge = createBadge("Token");
  const chips = createChipRow([color]);

  image.addEventListener("error", () => {
    card.classList.add("is-missing");
    image.remove();
  });

  card.append(fallback, image, scrim, badge, chips);
  return card;
}

function createNobleCard(combo, badgeText, ariaLabel) {
  const card = document.createElement("article");
  card.className = "card-frame";
  card.setAttribute("aria-label", ariaLabel);

  const badge = createBadge(badgeText);

  if (!combo) {
    card.classList.add("is-missing");
    card.append(
      badge,
      createFallbackContent("Missing combo", "No entry in combos.json", "Noble data missing"),
    );
    return card;
  }

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
    badge,
    createChipRow(combo.colors),
  );

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

  const badge = createLeftBadge("City");

  image.addEventListener("error", () => {
    card.classList.add("is-missing");
    image.remove();
  });

  card.append(fallback, image, scrim, badge);
  return card;
}

function createBadge(text) {
  const badge = document.createElement("span");
  badge.className =
    "absolute right-2 top-2 z-20 rounded-full border border-white/15 bg-slate-950/85 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white shadow-lg sm:right-3 sm:top-3 sm:text-[0.68rem]";
  badge.textContent = text;
  return badge;
}

function createLeftBadge(text) {
  const badge = document.createElement("span");
  badge.className =
    "absolute left-2 top-2 z-20 rounded-full border border-white/15 bg-slate-950/85 px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white shadow-lg sm:left-3 sm:top-3 sm:text-[0.68rem]";
  badge.textContent = text;
  return badge;
}

function createChipRow(colors) {
  const row = document.createElement("div");
  row.className =
    "absolute bottom-2 right-2 z-20 flex max-w-[42%] flex-col items-end gap-1.5 sm:bottom-3 sm:right-3";

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
  const candidates = new Set([buildImagePath(colors)]);

  for (const permutation of getPermutations(colors)) {
    candidates.add(buildImagePath(permutation));
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
  const candidateIndex = Number.parseInt(image.dataset.candidateIndex ?? "0", 10);
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

function renderError(error) {
  document.title = "Splendor Noble Grid";

  const panel = document.createElement("main");
  panel.className =
    "mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4 py-8";
  panel.innerHTML = `
    <section class="w-full rounded-[2rem] border border-white/12 bg-slate-950/60 p-8 text-center shadow-[0_18px_55px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p class="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.32em] text-amber-300">Splendor Randomizer</p>
      <h1 class="text-3xl font-black tracking-tight text-white sm:text-4xl">Could not load nobles</h1>
      <p class="mt-3 text-slate-300">${error instanceof Error ? error.message : "Unknown error"}</p>
    </section>
  `;

  root.replaceChildren(panel);
}
