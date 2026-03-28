export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getPermutations(items) {
  if (items.length <= 1) {
    return [items];
  }

  const permutations = [];

  for (let index = 0; index < items.length; index += 1) {
    const current = items[index];
    const remaining = items.filter((_, itemIndex) => itemIndex !== index);

    for (const permutation of getPermutations(remaining)) {
      permutations.push([current, ...permutation]);
    }
  }

  return permutations;
}
