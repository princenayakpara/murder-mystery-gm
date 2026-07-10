import { config } from '../config.js';
import { generateId } from '../utils/ids.js';
import { callText } from '../utils/anthropic.js';
import { generateMystery as generateMysteryCase } from './mysteryGenerator.js';
import {
  initMomentum,
  recordMessageAndCheckStall,
  checkTimeStall,
  recordAccusationAndCheckStall,
  markEventInjected,
  mostSuspectedSlot,
} from './stallDetector.js';
import {
  qaSystemPrompt,
  eventInjectionSystemPrompt,
  eventInjectionUserPrompt,
  revealSystemPrompt,
  revealUserPrompt,
  hintSystemPrompt,
} from './prompts.js';
import { templateEventNarration, templateQAAnswer, templateReveal, templateHint } from './templates.js';

const MAX_TRANSCRIPT_CHARS_FOR_AI = 12000;

function pushTranscript(room, entry) {
  const message = {
    id: generateId('m'),
    ts: Date.now(),
    ...entry,
  };
  room.transcript.push(message);
  return message;
}

function transcriptExcerpt(room, maxChars = MAX_TRANSCRIPT_CHARS_FOR_AI) {
  const lines = room.transcript.map((m) => {
    const who = m.authorName ? `${m.authorName}` : m.type === 'gm' || m.type === 'event' ? 'GAME MASTER' : 'SYSTEM';
    return `[${who}] ${m.text}`;
  });
  let text = lines.join('\n');
  if (text.length > maxChars) text = text.slice(text.length - maxChars);
  return text || '(no messages yet)';
}

function characterName(room, slot) {
  return room.mystery?.players.find((p) => p.player_slot === slot)?.character_name || null;
}

/** Which unrevealed hidden_information item to surface next, and for which character. */
function pickNextClue(room, { avoidSlot, focusSlot } = {}) {
  const revealedKeys = new Set(room.clues.map((c) => `${c.slot}:${c.index}`));

  const candidateSlots = room.mystery.players
    .map((p) => p.player_slot)
    .filter((slot) => {
      if (avoidSlot && slot === avoidSlot) return false;
      const character = room.mystery.players.find((p) => p.player_slot === slot);
      return character.hidden_information.some((_, i) => !revealedKeys.has(`${slot}:${i}`));
    });

  if (candidateSlots.length === 0) return null;

  let chosenSlot;
  if (focusSlot && candidateSlots.includes(focusSlot)) {
    chosenSlot = focusSlot;
  } else {
    // Spread clues evenly: prefer the slot with fewest clues revealed so far.
    chosenSlot = candidateSlots.sort((a, b) => {
      const aCount = room.clues.filter((c) => c.slot === a).length;
      const bCount = room.clues.filter((c) => c.slot === b).length;
      return aCount - bCount;
    })[0];
  }

  const character = room.mystery.players.find((p) => p.player_slot === chosenSlot);
  const index = character.hidden_information.findIndex((_, i) => !revealedKeys.has(`${chosenSlot}:${i}`));
  return { slot: chosenSlot, index, fact: character.hidden_information[index], characterName: character.character_name };
}

export const gameMaster = {
  async generateMystery({ theme, playerCount }) {
    return generateMysteryCase({ theme, playerCount });
  },

  initRoom(room) {
    room.momentum = initMomentum();
    room.clues = room.clues || [];
    room.events = room.events || [];
  },

  /** Public chat message from a player. Updates momentum and may trigger a GM event. */
  async handleChatMessage(room, { slot, name, text }) {
    const message = pushTranscript(room, { type: 'chat', authorSlot: slot, authorName: name, text });
    const decision = recordMessageAndCheckStall(room, { text });
    let event = null;
    if (decision.stalled) {
      event = await this.triggerEvent(room, decision.reason);
    }
    return { message, event };
  },

  /** Periodic tick (called on an interval) to catch stalls where nobody's typing new leads. */
  async tickTimeStall(room) {
    const decision = checkTimeStall(room);
    if (decision.stalled) {
      return this.triggerEvent(room, decision.reason);
    }
    return null;
  },

  async handleAccusation(room, { slot, name, targetSlot }) {
    const targetName = characterName(room, targetSlot);
    const message = pushTranscript(room, {
      type: 'accusation',
      authorSlot: slot,
      authorName: name,
      text: `${name} accuses ${targetName} of the murder.`,
      targetSlot,
    });
    const decision = recordAccusationAndCheckStall(room, targetSlot);
    let event = null;
    if (decision.stalled) {
      event = await this.triggerEvent(room, decision.reason, { avoidSlot: decision.avoidSlot });
    }
    return { message, event };
  },

  /** Direct "ask the GM" question. Always answers (does not count as a stall in itself). */
  async answerQuestion(room, { slot, name, question }) {
    const questionMsg = pushTranscript(room, {
      type: 'chat',
      authorSlot: slot,
      authorName: name,
      text: `${name} asks the Game Master: "${question}"`,
    });

    let answerText;
    if (config.hasAI) {
      try {
        answerText = await callText({
          system: qaSystemPrompt(room.mystery, room.difficulty),
          messages: [
            {
              role: 'user',
              content: `Transcript so far:\n${transcriptExcerpt(room)}\n\nClues already revealed: ${
                room.clues.map((c) => c.text).join(' | ') || '(none)'
              }\n\n${name} (playing ${characterName(room, slot)}) asks: "${question}"\n\nAnswer in-world now.`,
            },
          ],
          maxTokens: 400,
        });
      } catch (err) {
        console.error('[gameMaster] AI Q&A failed, using template fallback:', err.message);
        answerText = templateQAAnswer(question);
      }
    } else {
      answerText = templateQAAnswer(question);
    }

    const answerMsg = pushTranscript(room, { type: 'gm', authorSlot: null, authorName: 'Game Master', text: answerText });
    return { questionMsg, answerMsg };
  },

  /**
   * Explicit hint request — only offered to players on Easy difficulty (enforced by the
   * caller/socket handler, not here, so this stays a pure GM behavior function).
   */
  async giveHint(room, { slot, name }) {
    const requestMsg = pushTranscript(room, {
      type: 'chat',
      authorSlot: slot,
      authorName: name,
      text: `${name} asks the Game Master for a hint.`,
    });

    let hintText;
    if (config.hasAI) {
      try {
        hintText = await callText({
          system: hintSystemPrompt(room.mystery),
          messages: [
            {
              role: 'user',
              content: `Transcript so far:\n${transcriptExcerpt(room)}\n\nClues already revealed: ${
                room.clues.map((c) => c.text).join(' | ') || '(none)'
              }\n\nGive ${name} (playing ${characterName(room, slot)}) one useful hint now.`,
            },
          ],
          maxTokens: 250,
        });
      } catch (err) {
        console.error('[gameMaster] AI hint failed, using template fallback:', err.message);
        hintText = templateHint(room.clues.map((c) => c.text));
      }
    } else {
      hintText = templateHint(room.clues.map((c) => c.text));
    }

    const hintMsg = pushTranscript(room, { type: 'gm', authorSlot: null, authorName: 'Game Master', text: hintText });
    return { requestMsg, hintMsg };
  },

  /** Injects the next unrevealed clue as an in-fiction event. Logs the intervention reason. */
  async triggerEvent(room, reason, { avoidSlot } = {}) {
    const focusSlot = mostSuspectedSlot(room);
    const picked = pickNextClue(room, { avoidSlot, focusSlot });
    if (!picked) {
      markEventInjected(room);
      return null; // nothing left to reveal — let players work with what they have
    }

    let narration;
    if (config.hasAI) {
      try {
        narration = await callText({
          system: eventInjectionSystemPrompt(room.mystery, room.difficulty),
          messages: [
            {
              role: 'user',
              content: eventInjectionUserPrompt({
                mystery: room.mystery,
                transcriptExcerpt: transcriptExcerpt(room, 4000),
                revealedClues: room.clues.map((c) => c.text),
                focusCharacterName: picked.slot === focusSlot ? picked.characterName : null,
                factToReveal: picked.fact,
                reason,
              }),
            },
          ],
          maxTokens: 400,
        });
      } catch (err) {
        console.error('[gameMaster] AI event narration failed, using template fallback:', err.message);
        narration = templateEventNarration(picked.fact, picked.characterName);
      }
    } else {
      narration = templateEventNarration(picked.fact, picked.characterName);
    }

    const message = pushTranscript(room, { type: 'event', authorSlot: null, authorName: 'Game Master', text: narration });
    room.clues.push({
      id: generateId('c'),
      ts: Date.now(),
      slot: picked.slot,
      index: picked.index,
      text: picked.fact,
      characterName: picked.characterName,
    });
    room.events.push({ ts: Date.now(), reason, revealedFact: picked.fact, characterName: picked.characterName });
    markEventInjected(room);
    return message;
  },

  async generateReveal(room) {
    const votes = Object.entries(room.votes).map(([slot, targetSlot]) => characterName(room, targetSlot)).filter(Boolean);
    let text;
    if (config.hasAI) {
      try {
        text = await callText({
          system: revealSystemPrompt(room.mystery),
          messages: [
            {
              role: 'user',
              content: revealUserPrompt({
                transcript: transcriptExcerpt(room, MAX_TRANSCRIPT_CHARS_FOR_AI),
                revealedClues: room.clues.map((c) => c.text),
                votes,
              }),
            },
          ],
          maxTokens: 1500,
        });
      } catch (err) {
        console.error('[gameMaster] AI reveal failed, using template fallback:', err.message);
        text = templateReveal({ mystery: room.mystery, revealedClues: room.clues.map((c) => c.text), votes });
      }
    } else {
      text = templateReveal({ mystery: room.mystery, revealedClues: room.clues.map((c) => c.text), votes });
    }

    const murderer = room.mystery.players.find((p) => p.is_murderer);
    room.reveal = {
      text,
      murdererSlot: murderer.player_slot,
      murdererName: murderer.character_name,
      generatedAt: Date.now(),
    };
    pushTranscript(room, { type: 'reveal', authorSlot: null, authorName: 'Game Master', text });
    return room.reveal;
  },
};
