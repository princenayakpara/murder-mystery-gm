// Non-AI fallback narration, used when no ANTHROPIC_API_KEY is configured so the app
// still runs end-to-end offline.

const EVENT_FLAVORS = [
  (fact) => `A sudden gust rattles the shutters as the lights flicker back on. In the confusion, something new comes to light: ${fact}`,
  (fact) => `One of the staff hesitates, then steps forward with something they'd been too afraid to mention. "There's something you should know," they say. ${fact}`,
  (fact) => `Among the scattered papers on the desk, a detail nobody had noticed before surfaces. ${fact}`,
  (fact) => `A phone buzzes with a message that changes the shape of the night. ${fact}`,
  (fact) => `Someone finally speaks up after being quietly nudged by the others in the room. ${fact}`,
];

export function templateEventNarration(fact, focusCharacterName) {
  const flavor = EVENT_FLAVORS[Math.floor(Math.random() * EVENT_FLAVORS.length)];
  const prefix = focusCharacterName ? `Regarding the suspicion around ${focusCharacterName}: ` : '';
  return `${prefix}${flavor(fact)}`;
}

export function templateQAAnswer(question) {
  return `The Game Master considers the question carefully. "That's worth looking into," comes the reply, "but right now, the room offers no clearer answer than what you already know. Keep pressing — talk to each other, compare stories, and see what doesn't add up."`;
}

/** Easy-difficulty-only explicit hint, used when no AI is configured. */
export function templateHint(revealedClues) {
  if (!revealedClues.length) {
    return `"Here's a nudge," the Game Master offers. "Nothing concrete has come to light yet — press someone about where they really were during the blackout. Alibis are the fastest way to find a crack."`;
  }
  const pick = revealedClues[revealedClues.length - 1];
  return `"Here's a nudge," the Game Master offers. "Go back to this: ${pick} — ask around about who that actually points toward, and whether anyone's story doesn't quite line up with it."`;
}

export function templateReveal({ mystery, transcript, revealedClues, votes }) {
  const murderer = mystery.players.find((p) => p.is_murderer);
  const others = mystery.players.filter((p) => !p.is_murderer);

  const evidenceList = revealedClues.length
    ? revealedClues.map((c) => `- ${c}`).join('\n')
    : '- (No clues were surfaced during play.)';

  const lies = others
    .map((p) => `- ${p.character_name}: claimed "${p.alibi_claimed}" — actually "${p.true_whereabouts}"`)
    .join('\n');

  const voteTally = votes.length
    ? votes
        .reduce((acc, v) => {
          const found = acc.find((a) => a.name === v);
          if (found) found.count += 1;
          else acc.push({ name: v, count: 1 });
          return acc;
        }, [])
        .map((v) => `${v.name}: ${v.count} vote(s)`)
        .join(', ')
    : '(no votes cast)';

  return `THE TRUTH

The rain finally breaks, and with it, the truth about ${mystery.victim.name}'s death.

${murderer.character_name} is the murderer. ${murderer.true_whereabouts}

THE EVIDENCE THAT MATTERED
${evidenceList}

WHAT WAS MISSED
Some of the clues above went unremarked upon in the room's conversation — a sharper table would have cross-referenced every character's claimed alibi against the timeline above the moment two accounts stopped lining up.

LIES AND MISDIRECTION
${lies}

FINAL VOTES
${voteTally}

A careful investigator could have named ${murderer.character_name} by noticing that their claimed alibi was the one account nobody else could actually corroborate, once every other character's true whereabouts are laid side by side.`;
}
