# tumesh007.github.io — Engineering Project Hub & Portfolio

A clean, fast, zero-build-step static portfolio and project hub hosted on GitHub Pages at **[https://tumesh007.github.io/](https://tumesh007.github.io/)**.

Showcases parametric 3D print tools, client-side web applications, and embedded IoT systems with dynamic GitHub synchronization, rate-limit defense, and curated project metadata.

---

## ⚡ Key Architecture & Features

- **Zero-Build Stack:** 100% vanilla HTML5, CSS3, and ES6+ JavaScript. No Node.js build step, Webpack, or npm dependencies required.
- **Dynamic GitHub Sync:** On load, automatically fetches repositories from `https://api.github.com/users/tumesh007/repos?per_page=100&sort=updated`.
- **Rate-Limit Defense:** Caches the API response in `localStorage` with a 30-minute TTL. Includes graceful fallbacks so the site never shows a blank screen if rate-limited or offline.
- **Auto-Detected Smart Action Buttons:**
  - **🚀 Launch App:** Displayed automatically if `repo.homepage` or `repo.has_pages` is `true` (pointing to `https://tumesh007.github.io/${repo.name}/`).
  - **💾 Direct Download:** Surfaces curated release assets (e.g. `.stl`, `.apk`) or falls back to direct source zip (`.../archive/refs/heads/main.zip`).
  - **💻 Source Code:** Direct link to the repository on GitHub.
- **Curated Overrides (`config.json`):** Pin featured projects, hide non-portfolio repos, and enrich descriptions/tags without touching code.
- **Modern Maker Design:** High-contrast Dark theme (default) with smooth Light theme toggle, instant search, and category filter pills (`All`, `Featured`, `Web Apps`, `3D Printing & CAD`, `ESP32 & IoT`, `Android & Tools`).

---

## 🚀 Setup & Deployment Guide

Follow these exact steps to publish this portfolio to your GitHub Pages user site:

### 1. Create the GitHub Repository

Using GitHub CLI (`gh`):
```bash
gh repo create tumesh007/tumesh007.github.io --public --description "Engineering Project Hub & Portfolio"
```
*Or create it on [github.com/new](https://github.com/new) with the exact name `tumesh007.github.io`.*

### 2. Initialize and Push Local Files

Inside this directory (`/home/pnb/.gemini/antigravity/scratch/tumesh007.github.io`):
```bash
git init
git add .
git commit -m "feat: initial release of tumesh007.github.io project hub"
git branch -M main
git remote add origin https://github.com/tumesh007/tumesh007.github.io.git
git push -u origin main
```

### 3. Verify GitHub Pages

For user sites named `<username>.github.io`:
- GitHub Pages is automatically enabled and serves from the root of the `main` branch.
- Within 1–2 minutes, your site will be live at:
  **`https://tumesh007.github.io/`**

---

## 🛠️ How to Curate Projects via `config.json`

You do not need to touch `index.html` or `app.js` to customize the portfolio. Edit `config.json`:

### 1. Pinning Featured Projects
Add the exact repository name to the `featured` array:
```json
"featured": [
  "phone-wall-clock-enclosure-generator",
  "guava-home",
  "Shaving-Bowl"
]
```

### 2. Hiding Repositories
Add any repository name you wish to hide to the `hiddenRepos` array:
```json
"hiddenRepos": [
  "tumesh007.github.io",
  "tumesh007",
  "BankersToolkit"
]
```

### 3. Overriding Repo Metadata
Enrich titles, descriptions, custom categories, or direct release download links under `repoOverrides`:
```json
"Shaving-Bowl": {
  "title": "Parametric Shaving Lathering Bowl",
  "description": "Ergonomic 3D-printable shaving lathering bowl designed in OpenSCAD with textured interior micro-ridges.",
  "category": "3d-printing",
  "categoryLabel": "3D Printing / OpenSCAD",
  "tags": ["OpenSCAD", "3D Printing", "Parametric", "STL"],
  "homepage": "https://tumesh007.github.io/Shaving-Bowl/",
  "downloads": [
    {
      "label": "Download STL (v14.2)",
      "url": "https://github.com/tumesh007/Shaving-Bowl/releases/download/v14.2/Tumeshs_Shaving_Bowl_v14_2_STANDARD_bin.stl",
      "type": "stl"
    }
  ]
}
```

---

## 💻 Local Development & Testing

Since this is a zero-build static site, you can serve it locally using any HTTP server:

```bash
# Using Python 3
python3 -m http.server 8080

# Then open in browser:
# http://localhost:8080
```
