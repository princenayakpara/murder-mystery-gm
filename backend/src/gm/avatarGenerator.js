import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Deterministic, seeded SVG avatar generator.
//
// This project has no real image-generation API available (the Anthropic SDK used
// here is text/tool-call only — Claude's Messages API does not emit images), so this
// is the actual, working avatar pipeline rather than a stopgap: given the same
// case_id + character_name, it always produces the same illustrated placeholder
// (initials, a seeded color palette, and a simple geometric pattern), cached to disk
// so a replayed/reloaded game never regenerates or reflows an avatar.
//
// The cache + HTTP-serving shape (getOrCreateAvatar -> disk cache -> /api/avatars/...)
// is deliberately the same shape a real image-gen backend would use, so swapping in an
// actual model later only means changing renderAvatarSvg() to a fetch-and-cache call.

// Mirrors backend/src/db/index.js's DB_DIR convention so avatar cache also lives on
// the Railway volume (or wherever DB_DIR points) and survives redeploys.
function resolveAvatarDir() {
  const base = process.env.DB_DIR ? path.resolve(process.env.DB_DIR) : path.resolve(__dirname, '..', '..', 'data');
  const dir = path.join(base, 'avatars');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const AVATAR_DIR = resolveAvatarDir();

export function slugify(str) {
  return (str || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Small deterministic 32-bit string hash (FNV-1a variant) — no external deps. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 seeded PRNG — deterministic float stream from a 32-bit seed. */
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

function getInitials(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SHAPE_BUILDERS = [
  // concentric arcs
  (rand, w, h, accent) => {
    let s = '';
    for (let i = 0; i < 3; i++) {
      const r = 30 + i * 22 + rand() * 6;
      s += `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="none" stroke="${accent}" stroke-width="2" opacity="${0.18 - i * 0.04}"/>`;
    }
    return s;
  },
  // scattered triangles
  (rand, w, h, accent) => {
    let s = '';
    for (let i = 0; i < 5; i++) {
      const cx = rand() * w;
      const cy = rand() * h;
      const size = 14 + rand() * 20;
      s += `<polygon points="${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}" fill="${accent}" opacity="${0.1 + rand() * 0.12}"/>`;
    }
    return s;
  },
  // diagonal stripes
  (rand, w, h, accent) => {
    let s = '';
    for (let i = -2; i < 6; i++) {
      const x = i * 30 + rand() * 6;
      s += `<line x1="${x}" y1="0" x2="${x - h}" y2="${h}" stroke="${accent}" stroke-width="6" opacity="0.1"/>`;
    }
    return s;
  },
  // dot grid
  (rand, w, h, accent) => {
    let s = '';
    for (let gx = 0; gx < 6; gx++) {
      for (let gy = 0; gy < 6; gy++) {
        if (rand() > 0.6) {
          s += `<circle cx="${(gx + 0.5) * (w / 6)}" cy="${(gy + 0.5) * (h / 6)}" r="${3 + rand() * 3}" fill="${accent}" opacity="0.15"/>`;
        }
      }
    }
    return s;
  },
];

export const AVATAR_MOODS = ['neutral', 'pressure'];

/**
 * Renders a deterministic 256x256 SVG portrait for a character, seeded on
 * `${caseId}:${characterName}` so the same case always gets the same look.
 * `mood` gives a second, visually distinct pose for the VN dialogue layer: 'neutral'
 * (default, used everywhere else in the app) or 'pressure' (under-pressure — used
 * when the VN layer shows a character being accused or grilled). Mood only changes
 * framing/lighting, not the underlying seeded identity, so a character stays
 * recognizable across both.
 */
export function renderAvatarSvg(caseId, characterName, mood = 'neutral') {
  const seed = hashString(`${caseId}:${characterName}`);
  const rand = seededRandom(seed);

  // Hue picked from the seed; saturation/lightness kept in a tasteful, legible range
  // so initials text always reads clearly against the background.
  const hue = Math.floor(rand() * 360);
  const bgHue = hue;
  const bgSat = 42 + Math.floor(rand() * 18);
  const bgLight = 22 + Math.floor(rand() * 10);
  const accentHue = (hue + 30 + Math.floor(rand() * 60)) % 360;
  const accent = `hsl(${accentHue}, 70%, 60%)`;
  const bg1 = `hsl(${bgHue}, ${bgSat}%, ${bgLight}%)`;
  const bg2 = `hsl(${(bgHue + 40) % 360}, ${bgSat}%, ${bgLight + 10}%)`;

  const shapeBuilder = SHAPE_BUILDERS[Math.floor(rand() * SHAPE_BUILDERS.length)];
  const pattern = shapeBuilder(rand, 256, 256, accent);
  const initials = getInitials(characterName);
  const gradId = `g${seed}${mood}`;

  const isPressure = mood === 'pressure';
  // Under pressure: a tighter red-tinted vignette and a slight frame tilt read as
  // "cornered", while keeping the same base gradient/initials/pattern identity.
  const vignette = isPressure
    ? `<rect width="256" height="256" fill="url(#vignette${gradId})"/>`
    : '';
  const ringColor = isPressure ? '#c85a5a' : accent;
  const transform = isPressure ? ' transform="rotate(-2 128 128)"' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <radialGradient id="vignette${gradId}" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#9c3b3b" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3a0808" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <g${transform}>
    <rect width="256" height="256" fill="url(#${gradId})"/>
    <g>${pattern}</g>
    ${vignette}
    <circle cx="128" cy="128" r="118" fill="none" stroke="${ringColor}" stroke-width="3" opacity="0.4"/>
    <text x="128" y="128" text-anchor="middle" dominant-baseline="central"
          font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="700"
          fill="#f3ece1" opacity="0.94">${initials}</text>
  </g>
</svg>`;
}

function cachePath(caseId, slug, mood = 'neutral') {
  const caseDir = path.join(AVATAR_DIR, slugify(caseId));
  if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
  const suffix = mood === 'neutral' ? '' : `.${mood}`;
  return path.join(caseDir, `${slug}${suffix}.svg`);
}

/** Returns the cached SVG for this case+character+mood, generating and caching it on first call. */
export function getOrCreateAvatarSvg(caseId, characterName, mood = 'neutral') {
  const resolvedMood = AVATAR_MOODS.includes(mood) ? mood : 'neutral';
  const slug = slugify(characterName);
  const filePath = cachePath(caseId, slug, resolvedMood);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  const svg = renderAvatarSvg(caseId, characterName, resolvedMood);
  fs.writeFileSync(filePath, svg, 'utf-8');
  return svg;
}

/** Public URL path (relative) the frontend can point an <img> at. */
export function avatarUrlFor(caseId, characterName, mood = 'neutral') {
  const resolvedMood = AVATAR_MOODS.includes(mood) ? mood : 'neutral';
  const suffix = resolvedMood === 'neutral' ? '' : `.${resolvedMood}`;
  return `/api/avatars/${encodeURIComponent(slugify(caseId))}/${encodeURIComponent(slugify(characterName))}${suffix}.svg`;
}

/** Pre-warms the cache for every character in a mystery (both moods) — called once at game start. */
export function pregenerateAvatars(mystery) {
  for (const p of mystery.players) {
    for (const mood of AVATAR_MOODS) {
      getOrCreateAvatarSvg(mystery.case_id, p.character_name, mood);
    }
  }
}

export { AVATAR_DIR };
