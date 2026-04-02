#!/usr/bin/env bun
/**
 * build.ts — Rent Without Fear
 *
 * Reads content from content/ (Decap CMS managed),
 * renders Mustache templates from src/templates/,
 * outputs static HTML + CSS + JS into dist/
 *
 * Usage:
 *   bun run build          # one-shot build
 *   bun run dev            # watch mode (rebuilds on change)
 */

import fs from 'fs';
import path from 'path';
import Mustache from 'mustache';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { marked } from 'marked';

// ─── Paths ───────────────────────────────────────────────
const CONTENT_DIR = path.join(import.meta.dir, 'content');
const TEMPLATE_DIR = path.join(import.meta.dir, 'src', 'templates');
const PARTIALS_DIR = path.join(TEMPLATE_DIR, 'partials');
const CSS_DIR = path.join(import.meta.dir, 'src', 'css');
const JS_DIR = path.join(import.meta.dir, 'src', 'js');
const DIST_DIR = path.join(import.meta.dir, 'dist');

// ─── Helpers ─────────────────────────────────────────────

/** Read a YAML file, return parsed object (or empty obj) */
function readYaml(filepath: string): Record<string, any> {
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    return (yaml.load(raw) as Record<string, any>) || {};
  } catch { return {}; }
}

/** Read all markdown files in a folder, return array sorted by `order` or `date` */
function readCollection(folder: string): Record<string, any>[] {
  const dir = path.join(CONTENT_DIR, folder);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') || f.endsWith('.yml') || f.endsWith('.yaml'))
    .filter(f => f !== '.gitkeep')
    .map(f => {
      const filepath = path.join(dir, f);
      const raw = fs.readFileSync(filepath, 'utf8');

      if (f.endsWith('.yml') || f.endsWith('.yaml')) {
        return (yaml.load(raw) as Record<string, any>) || {};
      }

      const { data, content } = matter(raw);
      // Parse markdown body if present
      if (content && content.trim()) {
        data._body = marked.parse(content.trim());
      }
      data._slug = path.basename(f, path.extname(f));
      return data;
    })
    .sort((a, b) => {
      // Sort by order if present, else by date descending
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
      return 0;
    });
}

/** Load all Mustache partials from src/templates/partials/ */
function loadPartials(): Record<string, string> {
  const partials: Record<string, string> = {};
  if (!fs.existsSync(PARTIALS_DIR)) return partials;

  fs.readdirSync(PARTIALS_DIR)
    .filter(f => f.endsWith('.mustache'))
    .forEach(f => {
      const name = path.basename(f, '.mustache');
      partials[name] = fs.readFileSync(path.join(PARTIALS_DIR, f), 'utf8');
    });

  return partials;
}

/** Read a file if it exists, else return '' */
function readFileOr(filepath: string, fallback = ''): string {
  try { return fs.readFileSync(filepath, 'utf8'); } catch { return fallback; }
}

// ─── Build ───────────────────────────────────────────────

function build() {
  const startTime = Date.now();
  console.log('\n🔨 Building Rent Without Fear...');

  // 1. Read all content
  const data: Record<string, any> = {
    // Singletons
    settings: readYaml(path.join(CONTENT_DIR, 'settings', 'general.yml')),
    hero: readYaml(path.join(CONTENT_DIR, 'settings', 'hero.yml')),
    emergency_banner: readYaml(path.join(CONTENT_DIR, 'settings', 'emergency_banner.yml')),
    crisis_panel: readYaml(path.join(CONTENT_DIR, 'settings', 'crisis_panel.yml')),

    // Collections
    statistics: readCollection('statistics'),
    nav_grid: readCollection('nav_grid'),
    legal_rights: readCollection('legal_rights'),
    state_laws: readCollection('state_laws'),
    helplines: readCollection('helplines'),
    stories: readCollection('stories'),
    journal: readCollection('journal'),
    templates: readCollection('templates'),
    wall_posts: readCollection('wall_posts'),
    crisis_map_markers: readCollection('crisis_map_markers'),
  };

  // 2. Computed helpers for Mustache
  // Duplicate statistics for infinite ticker scroll
  data.statistics_doubled = [...data.statistics, ...data.statistics];

  // Separate featured vs regular stories
  data.featured_story = data.stories.find((s: any) => s.featured) || data.stories[0] || null;
  data.regular_stories = data.stories.filter((s: any) => s !== data.featured_story);

  // First journal article for the journal page
  data.latest_journal = data.journal[0] || null;
  if (data.latest_journal && data.latest_journal._body) {
    data.latest_journal.rendered_body = data.latest_journal._body;
  }

  // Map markers by type
  data.red_markers = (data.crisis_map_markers || []).filter((m: any) => m.marker_type === 'red');
  data.blue_markers = (data.crisis_map_markers || []).filter((m: any) => m.marker_type === 'blue');

  // Wall posts: separate urgent vs normal
  data.urgent_posts = (data.wall_posts || []).filter((p: any) => p.urgent);
  data.normal_posts = (data.wall_posts || []).filter((p: any) => !p.urgent);
  data.all_wall_posts = [...data.urgent_posts, ...data.normal_posts];

  // State laws: serialize as JSON for the JS state widget
  data.state_laws_json = JSON.stringify(data.state_laws || []);

  // Sidebar links from legal_rights
  data.sidebar_links = (data.legal_rights || []).map((cat: any, i: number) => ({
    ...cat,
    active_class: i === 0 ? 'active' : '',
  }));

  // Has checks for conditionals
  data.has_statistics = data.statistics.length > 0;
  data.has_nav_grid = data.nav_grid.length > 0;
  data.has_legal_rights = data.legal_rights.length > 0;
  data.has_stories = data.stories.length > 0;
  data.has_journal = data.journal.length > 0;
  data.has_templates = data.templates.length > 0;
  data.has_wall_posts = data.wall_posts.length > 0;
  data.has_helplines = data.helplines.length > 0;
  data.has_markers = data.crisis_map_markers.length > 0;
  data.has_emergency_banner = data.emergency_banner && data.emergency_banner.visible !== false;
  data.has_crisis_contacts = data.crisis_panel && data.crisis_panel.contacts && data.crisis_panel.contacts.length > 0;

  // 3. Load templates & partials
  const layoutTemplate = readFileOr(path.join(TEMPLATE_DIR, 'layout.mustache'));
  const partials = loadPartials();

  // 4. Render HTML
  const html = Mustache.render(layoutTemplate, data, partials);

  // 5. Read CSS and JS source files
  const css = readFileOr(path.join(CSS_DIR, 'style.css'));
  const js = readFileOr(path.join(JS_DIR, 'main.js'));

  // 6. Write to dist/
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
  fs.writeFileSync(path.join(DIST_DIR, 'style.css'), css);
  fs.writeFileSync(path.join(DIST_DIR, 'main.js'), js);

  // Copy admin folder to dist
  const adminDist = path.join(DIST_DIR, 'admin');
  fs.mkdirSync(adminDist, { recursive: true });
  fs.copyFileSync(path.join(import.meta.dir, 'admin', 'index.html'), path.join(adminDist, 'index.html'));
  fs.copyFileSync(path.join(import.meta.dir, 'admin', 'config.yml'), path.join(adminDist, 'config.yml'));

  // Copy static assets
  const staticSrc = path.join(import.meta.dir, 'static');
  const staticDist = path.join(DIST_DIR, 'static');
  if (fs.existsSync(staticSrc)) {
    copyDirSync(staticSrc, staticDist);
  }

  const elapsed = Date.now() - startTime;
  console.log(`✅ Built in ${elapsed}ms → dist/`);
  console.log(`   index.html  (${(html.length / 1024).toFixed(1)} KB)`);
  console.log(`   style.css   (${(css.length / 1024).toFixed(1)} KB)`);
  console.log(`   main.js     (${(js.length / 1024).toFixed(1)} KB)`);
}

/** Recursively copy directory */
function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

// ─── Run ─────────────────────────────────────────────────

build();

// Watch mode
if (process.argv.includes('--watch')) {
  const chokidar = await import('chokidar');
  console.log('\n👀 Watching for changes...');

  chokidar.watch([
    path.join(import.meta.dir, 'content', '**', '*'),
    path.join(import.meta.dir, 'src', '**', '*'),
  ], { ignoreInitial: true }).on('all', (event: string, filepath: string) => {
    console.log(`\n📝 ${event}: ${path.relative(import.meta.dir, filepath)}`);
    try { build(); } catch (e: any) { console.error('❌ Build error:', e.message); }
  });
}
