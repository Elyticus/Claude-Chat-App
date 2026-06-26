# Special-mode background images (Pro)

Drop the 8 illustration files here, named **exactly** as below. They are served
at `/special/<name>` and chosen by time of day + screen orientation in
`src/components/ui/special-field.jsx` (`IMAGES` map).

Filenames are **case-sensitive** (Netlify serves on Linux). Current set:

| Time of day      | Landscape (desktop)  | Portrait (mobile)        |
| ---------------- | -------------------- | ------------------------ |
| Morning / dawn   | `Morning.jpg`        | `Morning-Mobile.jpg`     |
| Afternoon / day  | `Afternoon.jpg`      | `Afternoon-Mobile.jpg`   |
| Evening / sunset | `Sunset.jpg`         | `Sunset-Mobile.jpg`      |
| Night            | `Night.jpg`          | `Night-Mobile.jpg`       |

Notes:
- Names must match the `IMAGES` map in `src/components/ui/special-field.jsx`
  exactly (including capitalisation).
- Landscape ≈ 1280×720 (16:9), Portrait ≈ 720×1280 — but any size works; they're
  rendered with `object-fit: cover`.
- Until a file is present, that period falls back to the built-in vector scene,
  so the app never shows a broken image.
