# AGENTS

- Avoid encoding transient implementation details in this file. Document durable conventions, pitfalls, and maintenance guidance instead.
- Follow some basic principles like DRY, KISS, Less is more, etc...
- Add documentation where applicable to ease cognitive load when reading code
- Favor small, single-purpose modules and filenames that communicate role clearly, such as `.data`, `.util` etc...
- Keep HTML declarative. Prefer stable structural markup in `index.html` and let JavaScript enhance or populate targeted regions instead of rebuilding whole page shells.
- Prefer event delegation over attaching many per-node listeners when rendering dynamic UI.
- Use Tailwind utilities for layout, spacing, typography, and common states. Use `styles.css` for reusable tokens, non-trivial selectors, media-query adjustments, and behavior Tailwind cannot express cleanly.
- When custom CSS is needed, route colors, shadows, radii, and similar values through shared design tokens instead of introducing one-off literals.
- Keep browser compatibility in mind for no-build static apps: use plain ES modules, avoid tooling-only assumptions, and keep paths explicit.
- If app entrypoints or static asset paths change, remember to update service worker cache lists and bump the cache version.
- Prioritize mobile tablet and desktop modes when writing code

# Styling

- prefer tailwind over raaw css
- prefer flex over grid
- prefer gap over margin
- prefer smaller border radii over larger
- less box-in-box type styling with too many borders
