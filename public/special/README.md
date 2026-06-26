# Special-mode background images (Pro)

Drop the 8 illustration files here, named **exactly** as below. They are served
at `/special/<name>` and chosen by time of day + screen orientation in
`src/components/ui/special-field.jsx` (`IMAGES` map).

Filenames are **case-sensitive** (Netlify serves on Linux). Current set:

| Time of day      | Landscape (desktop)  | Portrait (mobile)        |
| ---------------- | -------------------- | ------------------------ |
| Morning / dawn   | `Morning.svg`        | `Morning-Mobile.svg`     |
| Afternoon / day  | `Afternoon.svg`      | `Afternoon-Mobile.svg`   |
| Evening / sunset | `Sunset.svg`         | `Sunset-Mobile.svg`      |
| Night            | `Night.svg`          | `Night-Mobile.svg`       |

Notes:
- Names must match the `IMAGES` map in `src/components/ui/special-field.jsx`
  exactly (including capitalisation).
- SVG files are served as `<img>` elements with `object-fit: cover` — any
  viewBox will be scaled to fill the hub background.
- If a file is missing or fails to load, that period falls back to the
  built-in vector scene, so the app never shows a broken image.
- The Business AI colour-grade (CSS filters + tint overlay) is applied on
  top of these images via inline `filter` style — it works with SVG just as
  well as with raster images.
