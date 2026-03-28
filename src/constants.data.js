export const GITHUB_LINK = "https://github.com/deniszholob/splendor-randomizer";
export const DEV_MODE = false;
export const URL_TILE_DELIMITER = ".";
export const DEV_RELOAD_TARGETS = [
  "./index.html",
  "./styles.css",
  "./src/main.js",
  "./src/constants.data.js",
  "./src/render.util.js",
  "./src/shared.util.js",
  "./src/state.util.js",
  "./src/tiles.util.js",
];

export const COLORS = ["white", "red", "green", "blue", "black"];

export const COLOR_LABELS = {
  white: "White",
  red: "Red",
  green: "Green",
  blue: "Blue",
  black: "Black",
};

export const CITY_IMAGES = [
  "city-11+4-blue.webp",
  "city-11+4-green.webp",
  "city-12+1.webp",
  "city-13+2-black-green.webp",
  "city-13+2-blue-white.webp",
  "city-13+2-green-blue.webp",
  "city-13+2-red-black.webp",
  "city-13+2-white-red.webp",
  "city-13+5.webp",
  "city-14+2.webp",
  "city-14+5.webp",
  "city-15+1.webp",
  "city-16+5.webp",
  "city-17.webp",
  "city-28-x.webp",
];

export const NOBLE_COLOR_COMBOS = [
  ["white", "red"],
  ["white", "green"],
  ["white", "blue"],
  ["white", "black"],
  ["red", "green"],
  ["red", "blue"],
  ["red", "black"],
  ["green", "blue"],
  ["green", "black"],
  ["blue", "black"],
  ["white", "red", "green"],
  ["white", "red", "blue"],
  ["white", "red", "black"],
  ["white", "green", "blue"],
  ["white", "green", "black"],
  ["white", "blue", "black"],
  ["red", "green", "blue"],
  ["red", "green", "black"],
  ["red", "blue", "black"],
  ["green", "blue", "black"],
];

export const EXISTING_NOBLE_IMAGES = new Set([
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

export const PLAYER_ACCENTS = [
  {
    fill: "rgba(180, 138, 61, 0.78)",
    soft: "rgba(180, 138, 61, 0.6)",
    strong: "rgba(226, 196, 132, 0.42)",
    text: "#f8f3df",
  },
  {
    fill: "rgba(74, 112, 87, 0.78)",
    soft: "rgba(74, 112, 87, 0.6)",
    strong: "rgba(134, 171, 146, 0.4)",
    text: "#edf5ec",
  },
  {
    fill: "rgba(72, 102, 132, 0.78)",
    soft: "rgba(72, 102, 132, 0.6)",
    strong: "rgba(129, 163, 191, 0.4)",
    text: "#edf4fb",
  },
  {
    fill: "rgba(123, 79, 71, 0.78)",
    soft: "rgba(123, 79, 71, 0.6)",
    strong: "rgba(183, 138, 126, 0.4)",
    text: "#f8efea",
  },
  {
    fill: "rgba(111, 95, 72, 0.78)",
    soft: "rgba(111, 95, 72, 0.6)",
    strong: "rgba(171, 151, 119, 0.38)",
    text: "#f5f0e6",
  },
  {
    fill: "rgba(126, 64, 57, 0.78)",
    soft: "rgba(126, 64, 57, 0.6)",
    strong: "rgba(185, 116, 106, 0.38)",
    text: "#fbefed",
  },
  {
    fill: "rgba(55, 98, 97, 0.78)",
    soft: "rgba(55, 98, 97, 0.6)",
    strong: "rgba(110, 155, 153, 0.38)",
    text: "#ecf7f6",
  },
  {
    fill: "rgba(142, 97, 53, 0.78)",
    soft: "rgba(142, 97, 53, 0.6)",
    strong: "rgba(197, 155, 115, 0.38)",
    text: "#fbf3ea",
  },
];
