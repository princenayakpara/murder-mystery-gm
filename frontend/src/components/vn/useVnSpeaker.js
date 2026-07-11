import { useMemo } from 'react';

const SPEAKABLE_TYPES = new Set(['chat', 'gm', 'event', 'accusation', 'reveal']);
const NARRATOR_TYPES = new Set(['gm', 'event', 'reveal']);
// A recent event/accusation nudges the scene into "tension" framing for a short
// window, then settles back to plain investigation — a cheap proxy for "where the
// conversation's focus currently is" without any extra server state.
const TENSION_WINDOW_MS = 45 * 1000;

/**
 * Derives "who is currently speaking" from the existing chat transcript — no new
 * data path, just reading the same messages the chat log already renders. Returns
 * enough to drive SceneLayer + PortraitDock + DialogueBox.
 */
export function useVnSpeaker(transcript, avatars, roster) {
  return useMemo(() => {
    const rosterByName = new Map(roster.map((c) => [c.name, c]));
    let last = null;
    for (let i = transcript.length - 1; i >= 0; i--) {
      const m = transcript[i];
      if (SPEAKABLE_TYPES.has(m.type) && m.text) {
        last = m;
        break;
      }
    }

    let tense = false;
    for (let i = transcript.length - 1; i >= 0; i--) {
      const m = transcript[i];
      if ((m.type === 'accusation' || m.type === 'event') && Date.now() - m.ts < TENSION_WINDOW_MS) {
        tense = true;
      }
      if (Date.now() - m.ts > TENSION_WINDOW_MS) break;
    }

    if (!last) {
      return { speakerName: 'Game Master', kind: 'gm', text: null, avatarUrl: null, isGM: true, side: 'left', tense: false };
    }

    const isGM = NARRATOR_TYPES.has(last.type);
    const isAccusation = last.type === 'accusation';
    // Accusation text is third-person narration ("X accuses Y") — the portrait shown
    // "under pressure" should be the accused (targetSlot), not the accuser speaking.
    const portraitSlot = isAccusation ? last.targetSlot : last.authorSlot;
    let avatarUrl = null;
    if (!isGM && portraitSlot != null) {
      const set = avatars[portraitSlot];
      avatarUrl = set && (isAccusation ? set.pressure : set.neutral);
    } else if (!isGM && last.authorName) {
      const character = rosterByName.get(last.authorName);
      avatarUrl = character?.avatarUrl || null;
    }

    return {
      speakerName: isGM ? 'Game Master' : last.authorName,
      kind: last.type,
      text: last.text,
      avatarUrl,
      isGM,
      side: isGM ? 'left' : 'right',
      pressured: isAccusation,
      tense,
    };
  }, [transcript, avatars, roster]);
}
