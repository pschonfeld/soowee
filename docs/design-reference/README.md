# Design reference

Screenshots of Apple News+ Food, the default design reference (decision 5 in [AGENTS.md](../../AGENTS.md)). Use them to check layout, spacing, hierarchy and interaction patterns. Don't copy their assets, icons or photos.

Images in this folder are git-ignored: they are Apple's screens (one comes from a press article), kept for personal reference only. Only this README is committed, so the index below also tells you what exists when the images are missing.

## Index

| File | Shows |
|---|---|
| `recipe-page/hero-time-yield-iphone.jpg` | Hero on iPhone: photo fades into a tint taken from the photo; source, title, byline; **Total time + Yield**; story card; Cook / Save / Share; description; scroll chevron. Closest to our hero. |
| `recipe-page/hero-yield-only-iphone.jpg` | Same hero with a dark blue tint, Yield only. Note: our model always shows Total time + Yield. |
| `recipe-page/hero-directions-more-info-iphone.webp` | Three iPhone screens: hero; Directions with a sticky header (thumbnail + title) and Ingredients / Directions / More Info tabs, "STEP n" labels, bold amounts and ingredients, inline orange timer chip; More Info with tag chips and "More Like This" cards. |
| `recipe-page/full-page-ipad.jpg` | iPad: hero text on the left over the tint, photo on the right; below it, Ingredients (white rounded rows, quantity column) and Directions side by side. Also a small iPhone News+ Food home with a featured-recipe card. |
| `cook-mode/directions-step-iphone.jpg` | Cook mode: full-screen tint, recipe thumbnail + title + close button, Ingredients / Directions segmented control, current step large and bright, upcoming steps dimmed. |
| `gallery/catalog-iphone.jpg` | Recipe catalog: large title, search field, round category icons, horizontal rows ("Recently Viewed", "Saved Recipes") of cards with a tinted header strip, photo, title and time. |
| `gallery/saved-grid-iphone.jpg` | Saved recipes: two-column grid of the same cards, with search and filter. Reference for the planned home page gallery. |

**Not yet captured:** dark mode, the iPhone ingredients list, a timer running, the Cook mode Ingredients tab, the Save and Share sheets.

## Adding screenshots

Put each one in the folder for its area (`recipe-page/`, `cook-mode/`, `gallery/`), name it `<what>-<device>.<ext>`, and add a row to the index.

## If a screen is missing

Say so. Don't guess what the reference looks like.
