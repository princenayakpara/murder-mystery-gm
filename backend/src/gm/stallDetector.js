// Tracks "momentum" per room — how long it's been since the investigation last moved
// forward — and decides when the AI Game Master should proactively intervene.
//
// Thresholds scale with the room's difficulty (set at game creation, stored on
// room.difficulty): Easy nudges sooner and more often, Hard makes players work
// longer before the GM steps in. See gm/prompts.js for how difficulty also changes
// *how* the GM narrates (explicit vs. oblique) once it does intervene.

export const DIFFICULTY_STALL_CONFIG = {
  easy: {
    MESSAGE_THRESHOLD: 4,
    TIME_THRESHOLD_MS: 2 * 60 * 1000,
    REPEATED_ACCUSATION_THRESHOLD: 2,
  },
  medium: {
    MESSAGE_THRESHOLD: 6,
    TIME_THRESHOLD_MS: 4 * 60 * 1000,
    REPEATED_ACCUSATION_THRESHOLD: 3,
  },
  hard: {
    MESSAGE_THRESHOLD: 10,
    TIME_THRESHOLD_MS: 7 * 60 * 1000,
    REPEATED_ACCUSATION_THRESHOLD: 5,
  },
};

export function stallConfigFor(difficulty) {
  return DIFFICULTY_STALL_CONFIG[difficulty] || DIFFICULTY_STALL_CONFIG.medium;
}

// Backward-compatible default export some callers may still reference directly.
export const STALL_CONFIG = DIFFICULTY_STALL_CONFIG.medium;

/** Very small named-entity extractor: matches known character first/full names in free text. */
function extractMentionedSlots(text, mystery) {
  const found = new Set();
  const lower = text.toLowerCase();
  for (const p of mystery.players) {
    const nameParts = p.character_name.split(' ');
    const candidates = [p.character_name, nameParts[0]];
    if (candidates.some((c) => c && lower.includes(c.toLowerCase()))) {
      found.add(p.player_slot);
    }
  }
  return found;
}

export function initMomentum() {
  return {
    messagesSinceEvent: 0,
    lastEventTs: Date.now(),
    mentionedSlots: [],
    entityCountAtCheckpoint: 0,
    accusations: {}, // slot -> count since it was last "exhausted"
  };
}

/** Call once per incoming chat/accusation message. Returns a stall decision. */
export function recordMessageAndCheckStall(room, { text }) {
  const cfg = stallConfigFor(room.difficulty);
  const m = room.momentum;
  m.messagesSinceEvent += 1;

  if (room.mystery) {
    const mentioned = extractMentionedSlots(text, room.mystery);
    const before = new Set(m.mentionedSlots);
    mentioned.forEach((s) => before.add(s));
    m.mentionedSlots = Array.from(before);
  }

  if (m.messagesSinceEvent >= cfg.MESSAGE_THRESHOLD) {
    const newEntities = m.mentionedSlots.length > m.entityCountAtCheckpoint;
    m.entityCountAtCheckpoint = m.mentionedSlots.length;
    if (!newEntities) {
      return {
        stalled: true,
        reason: `Players exchanged ${m.messagesSinceEvent} messages without raising any new suspect or lead.`,
      };
    }
    // New ground was covered organically — reset the message counter but let the GM stay quiet.
    m.messagesSinceEvent = 0;
  }

  return { stalled: false };
}

/** Call on a timer per active room. Returns a stall decision based on elapsed silence. */
export function checkTimeStall(room) {
  const cfg = stallConfigFor(room.difficulty);
  const m = room.momentum;
  if (m.messagesSinceEvent === 0) return { stalled: false }; // nobody's even talking; don't force it
  const elapsed = Date.now() - m.lastEventTs;
  if (elapsed >= cfg.TIME_THRESHOLD_MS) {
    return {
      stalled: true,
      reason: `Players have gone ${Math.round(elapsed / 60000)} minute(s) without a new clue surfacing.`,
    };
  }
  return { stalled: false };
}

function slotClueCount(room, slot) {
  return room.clues.filter((c) => c.slot === slot).length;
}

function slotTotalHiddenInfo(room, slot) {
  const character = room.mystery.players.find((p) => p.player_slot === slot);
  return character ? character.hidden_information.length : 0;
}

/**
 * Records an accusation. If the target's hidden_information has already been fully
 * surfaced (nothing left to reveal about them) and they keep getting accused anyway,
 * flags a stall so the GM can redirect attention elsewhere.
 */
export function recordAccusationAndCheckStall(room, targetSlot) {
  const cfg = stallConfigFor(room.difficulty);
  const m = room.momentum;
  const exhausted = slotClueCount(room, targetSlot) >= slotTotalHiddenInfo(room, targetSlot) && slotTotalHiddenInfo(room, targetSlot) > 0;

  if (!exhausted) {
    m.accusations[targetSlot] = 0;
    return { stalled: false };
  }

  m.accusations[targetSlot] = (m.accusations[targetSlot] || 0) + 1;
  if (m.accusations[targetSlot] >= cfg.REPEATED_ACCUSATION_THRESHOLD) {
    m.accusations[targetSlot] = 0;
    const character = room.mystery.players.find((p) => p.player_slot === targetSlot);
    return {
      stalled: true,
      reason: `Players accused ${character?.character_name || 'the same suspect'} repeatedly even though all known evidence about them is already public.`,
      avoidSlot: targetSlot,
    };
  }
  return { stalled: false };
}

export function markEventInjected(room) {
  room.momentum.lastEventTs = Date.now();
  room.momentum.messagesSinceEvent = 0;
}

/** Picks which character's suspicion is "hottest" right now, to focus the next clue on them. */
export function mostSuspectedSlot(room) {
  const counts = room.momentum.accusations;
  let best = null;
  let bestCount = 0;
  for (const [slot, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = Number(slot);
      bestCount = count;
    }
  }
  return best;
}
