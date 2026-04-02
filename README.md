# Rent Without Fear — CMS + Build Pipeline

Decap CMS + Netlify + Mustache.js templating with a custom Node.js build script.

## Architecture

```
content/                  ← Decap CMS writes here (markdown + YAML)
src/
  templates/
    layout.mustache       ← Main HTML shell
    partials/             ← One partial per page section
      nav.mustache
      page_home.mustache
      page_rights.mustache
      page_stories.mustache
      page_journal.mustache
      page_action.mustache
      page_map.mustache
      page_wall.mustache
      toast.mustache
  css/style.css           ← All styles (extracted from original HTML)
  js/main.js              ← All interactivity (routing, widgets, wall, etc.)
admin/
  config.yml              ← Decap CMS collection definitions
  index.html              ← CMS admin UI
build.js                  ← Reads content → renders Mustache → outputs dist/
dist/                     ← Build output (deployed by Netlify)
  index.html
  style.css
  main.js
  admin/
```

## How It Works

1. **Editors** use Decap CMS at `/admin/` to create/edit content
2. CMS commits markdown + YAML files to `content/` via Git Gateway
3. Netlify detects the commit and runs `npm run build`
4. **build.js** reads all content, feeds it into Mustache partials, writes `dist/`
5. Netlify serves the static files from `dist/`

### Editorial Workflow

```
Draft → In Review → Ready → Published
```

All content goes through PR-based review before merging to `main`.

## Collections

| Collection | CMS Path | Mustache Partial |
|---|---|---|
| Site Settings | `content/settings/general.yml` | `layout.mustache` |
| Homepage Hero | `content/settings/hero.yml` | `page_home` |
| Emergency Banner | `content/settings/emergency_banner.yml` | `page_home` |
| Crisis Panel | `content/settings/crisis_panel.yml` | `page_action` |
| Ticker Statistics | `content/statistics/` | `page_home` |
| Homepage Grid | `content/nav_grid/` | `page_home` |
| Know Your Rights | `content/legal_rights/` | `page_rights` |
| State Laws | `content/state_laws/` | `page_rights` (JS widget) |
| Helplines | `content/helplines/` | `page_rights` |
| Stories | `content/stories/` | `page_stories` |
| Journal | `content/journal/` | `page_journal` |
| Legal Templates | `content/templates/` | `page_action` |
| Wall Posts | `content/wall_posts/` | `page_wall` |
| Crisis Map Markers | `content/crisis_map_markers/` | `page_map` |

## Local Development

```bash
npm install
npm run build        # One-shot build
npm run dev          # Watch mode — rebuilds on any content/ or src/ change
```

## Deploy to Netlify

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial setup"
git remote add origin git@github.com:YOUR_USER/rent-without-fear.git
git push -u origin main
```

### 2. Connect Netlify
1. [app.netlify.com](https://app.netlify.com) → Add new site → Import existing project
2. Connect GitHub repo
3. Build command: `npm install && npm run build` (auto-detected from `netlify.toml`)
4. Publish directory: `dist`

### 3. Enable Identity + Git Gateway
1. Netlify dashboard → Integrations → Identity → Enable
2. Identity → Settings → Services → Enable Git Gateway
3. Identity → Settings → Registration → Invite only
4. Invite editors via Identity → Invite users

### 4. Access CMS
`https://your-site.netlify.app/admin/`

## Adding Content

Create markdown files in the appropriate `content/` subfolder. Each file uses YAML frontmatter matching the fields defined in `admin/config.yml`. Example:

**content/stories/2024-03-15-my-story.md**
```yaml
---
title: "My Story Title"
excerpt: "A brief description..."
tag: "Discrimination"
tag_style: "default"
city: "Mumbai"
date: 2024-03-15T00:00:00.000Z
featured: false
---
Optional long-form markdown body here.
```

Or just use the CMS UI — it generates these files for you.
