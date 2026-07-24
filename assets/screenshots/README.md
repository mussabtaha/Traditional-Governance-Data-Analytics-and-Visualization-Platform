# Application Screenshot Guide

This folder is reserved for authentic screenshots of the running Traditional
Governance Data Analytics and Visualization Platform.

Do not add generated mockups, edited data, browser-error pages, or images that
could be mistaken for a working feature. Capture the real application after the
frontend and API have loaded successfully.

Use the deployed frontend:

```text
https://traditional-governance-frontend.onrender.com
```

## Recommended screenshots

| Filename | Page or state | Capture guidance |
|---|---|---|
| `home-dashboard.png` | Home dashboard | English, light mode; include the hero, summary cards, and main exploration cards. |
| `groups-explorer.png` | Groups page | English, light mode; show search, filters, populated table, and pagination. |
| `statistics-dashboard.png` | Statistics page | Show representative charts with their headings and live data. |
| `comparison-view.png` | Comparison page | Select two real groups and show both profiles plus part of the comparison table. |
| `arabic-interface.png` | Representative Arabic page | Show Arabic text, correct RTL layout, and translated controls. |
| `dark-mode.png` | Representative dark-mode page | Show the saved dark theme on a data-rich page. |
| `contact-page.png` | Contact page | Capture only after deployed email delivery is verified; leave all visitor fields empty. |

Current status: all seven PNG files require manual capture. Browser inspection
confirmed that the deployed homepage loads live data, but the screenshot command
timed out during the documentation update. No substitute image was generated.

## Recommended viewport sizes

- Primary desktop capture: **1440 × 900**
- Laptop verification: **1366 × 768**
- Tablet verification: **768 × 1024**
- Mobile verification: **390 × 844**

Use the desktop size for README images. Use the smaller sizes to confirm that
the responsive layout remains correct before capturing the final desktop image.

## Capture checklist

1. Open the deployed frontend URL and use real data from the working API.
2. Wait until loaders disappear and charts finish rendering.
3. Use a clean browser window without developer tools or personal bookmarks.
4. Confirm the page has no console or API-loading error before capturing it.
5. Capture English/light mode for the main page images.
6. Switch to Arabic and confirm RTL layout before capturing `arabic-interface.png`.
7. Switch to dark mode and confirm charts, tables, and controls remain readable
   before capturing `dark-mode.png`.
8. Crop consistently while retaining the page title and relevant controls.
9. Remove personal data from form fields before capturing.
10. Save PNG files with the exact lowercase, URL-safe names listed above.
11. Optimize large images before committing them to Git.

After adding screenshots, replace the corresponding status rows in the root
[`README.md`](../../README.md#project-preview) with responsive image elements
and accurate captions. Include one large homepage preview followed by
side-by-side feature images only when every referenced PNG exists.
