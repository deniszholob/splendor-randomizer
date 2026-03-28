import {
  CITY_IMAGES,
  COLORS,
  EXISTING_NOBLE_IMAGES,
  NOBLE_COLOR_COMBOS,
} from "./constants.data.js";
import { getPermutations } from "./shared.util.js";

export function normalizeColors(colors) {
  return [...colors].sort(
    (left, right) => COLORS.indexOf(left) - COLORS.indexOf(right),
  );
}

export function comboId(colors) {
  return colors.join("-");
}

export function buildImagePath(colors) {
  return `assets/nobles/${comboId(colors)}.webp`;
}

export function buildNoblePool() {
  return NOBLE_COLOR_COMBOS.map((colors) => {
    const normalizedColors = normalizeColors(colors);

    return {
      kind: "nobles",
      id: comboId(normalizedColors),
      colors: normalizedColors,
      image: buildImagePath(normalizedColors),
    };
  });
}

export function buildCityPool() {
  return CITY_IMAGES.map((filename) => ({
    kind: "cities",
    filename,
    image: `assets/cities/${filename}`,
  }))
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
    })
    .map((city, index) => ({
      ...city,
      id: `c${index + 1}`,
      number: index + 1,
      title: `City ${index + 1}`,
    }));
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

export function buildImageCandidates(colors) {
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
