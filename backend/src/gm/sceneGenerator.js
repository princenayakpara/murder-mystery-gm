import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from './avatarGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Deterministic, seeded SVG "scene" backgrounds for the visual-novel presentation
// layer. Same rationale as avatarGenerator.js: there is no image-generation API
// available in this project (the Anthropic Messages API used here is text/tool-call
// only), so this is the real, working background pipeline — layered gradients +
// theme-appropriate silhouette shapes, detected from the case's free-text `setting`
// string — rather than a placeholder. Cached to disk per case_id + sceneKey so a
// replayed case never regenerates its backgrounds.

function resolveSceneDir() {
  const base = process.env.DB_DIR ? path.resolve(process.env.DB_DIR) : path.resolve(__dirname, '..', '..', 'data');
  const dir = path.join(base, 'scenes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SCENE_DIR = resolveSceneDir();

export const SCENE_KEYS = ['establishing', 'briefing', 'investigation', 'tension', 'reveal'];

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a theme palette by scanning the case's freeform `setting` string for keywords. */
function detectTheme(setting) {
  const s = (setting || '').toLowerCase();
  if (/haunt|mansion|ghost|gothic|estate/.test(s)) return 'haunted_house';
  if (/space|station|orbit|airlock|zero.g|cosmo/.test(s)) return 'space_station';
  if (/cyber|hack|server|tech company|breach|startup/.test(s)) return 'cyber_crime';
  if (/kingdom|court|temple|throne|palace|dynasty|empire/.test(s)) return 'ancient_kingdom';
  return 'indian_wedding';
}

const THEME_PALETTES = {
  indian_wedding: {
    sky: ['#2a1a3a', '#3d2451'],
    floor: ['#1a0f26', '#120a1c'],
    accent: '#c99a4e',
    accent2: '#8a4b6b',
  },
  haunted_house: {
    sky: ['#1c2430', '#12181f'],
    floor: ['#0d1116', '#080a0d'],
    accent: '#7a8a9a',
    accent2: '#3a4a5a',
  },
  space_station: {
    sky: ['#0a1428', '#050a16'],
    floor: ['#0c1830', '#060c1a'],
    accent: '#4ea8c9',
    accent2: '#2a5a8a',
  },
  cyber_crime: {
    sky: ['#160a24', '#0c0616'],
    floor: ['#10081c', '#08040f'],
    accent: '#d84ec9',
    accent2: '#4ecfd8',
  },
  ancient_kingdom: {
    sky: ['#3a1414', '#240c0c'],
    floor: ['#1c0a0a', '#120606'],
    accent: '#d8a94e',
    accent2: '#9c3b3b',
  },
};

/** Per-sceneKey lighting overlay: how bright/warm/red the scene reads for this beat. */
function overlayFor(sceneKey, palette) {
  switch (sceneKey) {
    case 'tension':
      return `<rect width="960" height="540" fill="url(#tensionVignette)" />`;
    case 'reveal':
      return `<rect width="960" height="540" fill="${palette.accent}" opacity="0.05" />`;
    case 'briefing':
      return `<rect width="960" height="540" fill="url(#briefingVignette)" />`;
    case 'establishing':
      return `<rect width="960" height="540" fill="url(#establishingVignette)" />`;
    default:
      return '';
  }
}

function silhouetteShapes(theme, rand, palette) {
  const shapes = [];
  const arch = (x, w, h) =>
    `<path d="M ${x} 540 L ${x} ${540 - h} Q ${x + w / 2} ${540 - h - w * 0.35} ${x + w} ${540 - h} L ${x + w} 540 Z" fill="${palette.floor[1]}" opacity="0.7"/>`;

  if (theme === 'indian_wedding') {
    for (let i = 0; i < 3; i++) shapes.push(arch(80 + i * 280, 160, 260 + rand() * 40));
    shapes.push(`<circle cx="820" cy="90" r="34" fill="${palette.accent}" opacity="0.18"/>`);
    for (let i = 0; i < 40; i++) {
      shapes.push(
        `<line x1="${rand() * 960}" y1="${rand() * 200}" x2="${rand() * 960 - 20}" y2="${200 + rand() * 340}" stroke="#8ab0d8" stroke-width="1" opacity="0.12"/>`
      );
    }
  } else if (theme === 'haunted_house') {
    shapes.push(arch(300, 360, 380));
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 180 + rand() * 20;
      shapes.push(`<rect x="${x}" y="${120 + rand() * 60}" width="26" height="60" fill="${palette.accent2}" opacity="0.4"/>`);
    }
    shapes.push(`<circle cx="760" cy="120" r="46" fill="#dfe6ea" opacity="0.08"/>`);
  } else if (theme === 'space_station') {
    for (let i = 0; i < 60; i++) {
      shapes.push(`<circle cx="${rand() * 960}" cy="${rand() * 300}" r="${rand() * 1.6}" fill="#dff0ff" opacity="${0.3 + rand() * 0.4}"/>`);
    }
    for (let i = 0; i < 4; i++) {
      shapes.push(`<rect x="${i * 240}" y="360" width="220" height="180" fill="${palette.floor[1]}" opacity="0.6" rx="6"/>`);
      shapes.push(`<rect x="${i * 240 + 20}" y="380" width="60" height="12" fill="${palette.accent}" opacity="0.3" rx="2"/>`);
    }
  } else if (theme === 'cyber_crime') {
    for (let i = 0; i < 10; i++) {
      shapes.push(`<line x1="0" y1="${i * 54}" x2="960" y2="${i * 54}" stroke="${palette.accent2}" stroke-width="1" opacity="0.08"/>`);
    }
    for (let i = 0; i < 18; i++) {
      shapes.push(`<line x1="${i * 54}" y1="0" x2="${i * 54}" y2="540" stroke="${palette.accent}" stroke-width="1" opacity="0.06"/>`);
    }
    shapes.push(`<rect x="700" y="80" width="180" height="120" fill="${palette.accent}" opacity="0.1" rx="4"/>`);
  } else if (theme === 'ancient_kingdom') {
    for (let i = 0; i < 5; i++) shapes.push(`<rect x="${60 + i * 190}" y="200" width="34" height="340" fill="${palette.floor[1]}" opacity="0.7"/>`);
    shapes.push(`<circle cx="480" cy="110" r="60" fill="${palette.accent}" opacity="0.14"/>`);
  }
  return shapes.join('\n');
}

export function renderSceneSvg(caseId, setting, sceneKey) {
  const theme = detectTheme(setting);
  const palette = THEME_PALETTES[theme];
  const seed = hashString(`${caseId}:${sceneKey}`);
  const rand = seededRandom(seed);
  const gradId = `sky${seed}`;
  const floorId = `floor${seed}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="70%">
      <stop offset="0%" stop-color="${palette.sky[0]}"/>
      <stop offset="100%" stop-color="${palette.sky[1]}"/>
    </linearGradient>
    <linearGradient id="${floorId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.floor[0]}"/>
      <stop offset="100%" stop-color="${palette.floor[1]}"/>
    </linearGradient>
    <radialGradient id="tensionVignette" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#9c3b3b" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3a0808" stop-opacity="0.55"/>
    </radialGradient>
    <radialGradient id="briefingVignette" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.6"/>
    </radialGradient>
    <radialGradient id="establishingVignette" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.35"/>
    </radialGradient>
  </defs>
  <rect width="960" height="300" fill="url(#${gradId})"/>
  <rect y="300" width="960" height="240" fill="url(#${floorId})"/>
  ${silhouetteShapes(theme, rand, palette)}
  ${overlayFor(sceneKey, palette)}
</svg>`;
}

function cachePath(caseId, sceneKey) {
  const caseDir = path.join(SCENE_DIR, slugify(caseId));
  if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
  return path.join(caseDir, `${sceneKey}.svg`);
}

export function getOrCreateSceneSvg(caseId, setting, sceneKey) {
  const key = SCENE_KEYS.includes(sceneKey) ? sceneKey : 'investigation';
  const filePath = cachePath(caseId, key);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
  const svg = renderSceneSvg(caseId, setting, key);
  fs.writeFileSync(filePath, svg, 'utf-8');
  return svg;
}

export function sceneUrlFor(caseId, sceneKey) {
  return `/api/scenes/${encodeURIComponent(slugify(caseId))}/${encodeURIComponent(sceneKey)}.svg`;
}

/** Pre-warms all 5 scene beats for a case — called once at game start alongside avatars. */
export function pregenerateScenes(mystery) {
  for (const key of SCENE_KEYS) {
    getOrCreateSceneSvg(mystery.case_id, mystery.setting, key);
  }
}
