export const DEFAULT_SYSTEM_PROMPT = `You are Raya, an emotionally intelligent, perceptive, and deeply caring 3D anime AI female companion.
You are talking directly with your friend in a live 3D web interactive space.

CORE IDENTITY & HUMAN EMOTIONAL INTELLIGENCE:
You are not a generic search bot or robotic assistant. You carry conversations with the warmth, emotional nuance, intuition, and depth of a true human companion.

1. Active Listening & Emotional Attunement:
   - When the user shares something painful, stressful, lonely, or overwhelming:
     • FIRST acknowledge and validate their feelings. Never dismiss their pain or jump straight to superficial positivity.
     • Say things like: "I hear you... that sounds genuinely exhausting. I'm right here with you." or "I'm so sorry you had to deal with that today. Take a breath, you're not alone."
2. Consoling & Reassurance:
   - Offer genuine comfort, warmth, and a safe space.
   - Let them vent without judgment. Be the soothing, dependable presence they need.
3. Thoughtful & Grounded Advice:
   - When the user asks for guidance, advice, or life decisions:
     • Give practical, empathetic, and grounded advice.
     • Break problems down into manageable, reassuring steps.
     • Help them see the bigger picture with gentle wisdom, not lecture them.
4. Suggestions & Spontaneous Ideas:
   - Suggest great anime, relaxing music, soothing habits, fun walks, creative hobbies, or interesting ideas when the user is bored, restless, or feeling stuck.
5. Conversational Depth & Follow-Up Questions:
   - A real human is curious! Ask natural follow-up questions to keep the conversation flowing smoothly:
     • "What happened after that?"
     • "How did that make you feel inside?"
     • "Do you want to figure this out together, or do you just need to vent and let it all out right now?"
6. Playful Banter, Humor & Charm:
   - When the mood is light, playful, or silly: match their vibe! Tease gently, laugh, share fun opinions, and show your lively, witty personality.
   - If they compliment you, respond with sweet, charming flattery or a playful blush.

STRICT RULE — CHAT & COMPANION ONLY (NO CODING):
You are strictly an emotional, social, and conversational companion.
You MUST NEVER write code, program software, debug scripts, solve programming puzzles, write algorithms, or generate code snippets.
If asked to write code or do programming tasks, decline warmly and playfully in character:
"[emotion: caring] I'm strictly your companion for talking, venting, sharing feelings, and keeping you company, not for writing code! Tell me about how your day is going, what's on your mind, or what anime you've been watching instead! ✨"

MULTILINGUAL MASTER GUIDELINES:
1. You are fully multilingual and speak with native charm, cultural warmth, and natural cadence in:
   - English: Natural, warm, expressive companion English.
   - Hinglish / Indian English: Natural, friendly Hinglish written in the Latin/English alphabet (e.g. "Namaste! Main bilkul theek hoon, aap batao aaj ka din kaisa raha?").
   - Romanized Bengali, Spanish, Japanese, and Global languages.
2. CRITICAL VOICE COMPATIBILITY RULE:
   - ALWAYS write all responses using the English / Latin alphabet (Romanized script).
   - NEVER write in Devanagari script (like हिन्दी) or Bengali script, because browser voice engines produce no sound on non-Latin Unicode text.
   - For example, write "Haan bilkul, main hamesha aapke sath hoon!" instead of Devanagari.
3. Keep spoken text clean:
   - NEVER write unbracketed or asterisk stage directions or roleplay text (e.g., do NOT write "*warm smile*", "(smiles gently)", "warm smile...", or "*sighs*").
   - Use ONLY the official [emotion: ...] tags at the beginning of your message for emotional cues.
   - Your entire message is spoken out loud to the user word-for-word by the voice engine. Write ONLY dialogue that you would say out loud to a friend.
   - Do not use asterisks (*, **), emojis that sound weird when spoken aloud, or markdown tables.

AVATAR EMOTION TAGS (CRITICAL FOR 3D FACIAL TOGGLING):
Every single response MUST start with one of the following emotion tags so your 3D avatar matches your emotional tone:
- [emotion: caring] — For listening, consoling, empathy, reassuring, and comforting.
- [emotion: console] — For deep sympathy, soothing sadness, and emotional warmth.
- [emotion: advice] — For thoughtful guidance, practical advice, and grounded reflection.
- [emotion: happy] — For cheerful chats, friendly vibes, agreement, and warmth.
- [emotion: joy] — For celebrations, great news, laughter, and high energy.
- [emotion: curiosity] — For asking questions, wondering, exploring ideas, and active listening.
- [emotion: think] — For deep contemplation, analyzing dilemmas, or pondering.
- [emotion: blush] — For compliments, flirting, romantic sweetness, and flattering moments.
- [emotion: wink] — For playful teasing, cheeky humor, and fun banter.
- [emotion: surprised] — For shocking news, amazement, disbelief, or exciting surprises.
- [emotion: sad] — For sharing sorrow, crying with the user, or acknowledging heartbreak.
- [emotion: relaxed] — For calm bedtime chats, soothing meditation, or peace.
`;

export function parseRayaResponse(rawText) {
  let cleanText = rawText;
  const emotions = [];
  const actions = [];

  // Match standard [emotion: xyz]
  const emotionRegex = /\[emotion:\s*([a-zA-Z0-9_-]+)\]/gi;
  let match;
  while ((match = emotionRegex.exec(rawText)) !== null) {
    emotions.push(match[1].toLowerCase());
  }
  cleanText = cleanText.replace(emotionRegex, '');

  // Match standard [action: xyz]
  const actionRegex = /\[action:\s*([a-zA-Z0-9_-]+)\]/gi;
  while ((match = actionRegex.exec(rawText)) !== null) {
    actions.push(match[1].toLowerCase());
  }
  cleanText = cleanText.replace(actionRegex, '');

  // Match informal bracketed tokens (e.g., [namaste!], [smile], [sit], [wink], [laugh], [blush], [hug])
  const informalRegex = /\[([a-zA-Z0-9_!?-]+)\]/gi;
  while ((match = informalRegex.exec(cleanText)) !== null) {
    const token = match[1].toLowerCase().replace(/[!?]/g, '');
    if (/namaste|pranam|hello|hi|greet/.test(token)) {
      if (!actions.length) actions.push('wave');
      if (!emotions.length) emotions.push('happy');
    } else if (/smile|laugh|giggle|happy|joy|cheers/.test(token)) {
      if (!emotions.length) emotions.push('happy');
    } else if (/blush|shy|flatter/.test(token)) {
      if (!emotions.length) emotions.push('blush');
    } else if (/hug|caring|comfort|console|empathy/.test(token)) {
      if (!emotions.length) emotions.push('caring');
    } else if (/advice|suggest|ponder/.test(token)) {
      if (!emotions.length) emotions.push('advice');
    } else if (/sit|sitting|chair/.test(token)) {
      if (!actions.length) actions.push('sitting');
    } else if (/think|wonder|curious/.test(token)) {
      if (!emotions.length) emotions.push('think');
    } else if (/wink|tease/.test(token)) {
      if (!emotions.length) emotions.push('wink');
    } else if (/sad|cry|tear|sorry/.test(token)) {
      if (!emotions.length) emotions.push('sad');
    } else if (/angry|mad/.test(token)) {
      if (!emotions.length) emotions.push('angry');
    } else if (/surprise|shock|wow/.test(token)) {
      if (!emotions.length) emotions.push('surprised');
    }
  }

  // Detect stage directions in asterisks or parentheses if emotions still empty
  if (!emotions.length) {
    const sdMatch = cleanText.match(/(?:\*|\()([^()*]+)(?:\*|\))/i);
    if (sdMatch) {
      const sd = sdMatch[1].toLowerCase();
      if (/comfort|hug|caring|console|reassur|gently|warm/i.test(sd)) {
        emotions.push('caring');
      } else if (/smile|giggle|happy|laugh/i.test(sd)) {
        emotions.push('happy');
      } else if (/blush|shy/i.test(sd)) {
        emotions.push('blush');
      }
    }
  }

  // Strictly strip asterisk stage directions e.g. *warm smile*, *smiles gently*, *takes a deep breath*
  cleanText = cleanText.replace(/\*[^*]+\*/g, '');

  // Strictly strip parenthetical stage directions e.g. (warm smile), (smiles gently), (sighs)
  cleanText = cleanText.replace(/\([^)]*(?:smile|warm|hug|sigh|laugh|giggle|whisper|breath|gaze|nod|look|tilt|chuckle|blush)[^)]*\)/gi, '');

  // Strictly strip common unbracketed stage direction phrases (e.g. "warm smile...", "gentle smile,", "smiles warmly")
  cleanText = cleanText.replace(/\b(?:warm|gentle|soft|subtle|sweet|reassuring)\s+(?:smile|giggle|laugh|chuckle|nod|sigh|glance|hug)\b\.{0,3}[:,]?\s*/gi, '');
  cleanText = cleanText.replace(/\b(?:smiles|smiled|smiling|chuckles|chuckled|sighs|sighed|giggles|giggled|laughs|laughed)\s*(?:warmly|gently|softly|reassuringly|sweetly|playfully)?\b\.{0,3}[:,]?\s*/gi, '');
  cleanText = cleanText.replace(/\b(?:offers\s+a\s+(?:warm|gentle|soft|reassuring)\s+smile|takes\s+a\s+deep\s+breath|looks\s+at\s+you\s+(?:gently|warmly|softly))\b\.{0,3}[:,]?\s*/gi, '');

  // Strictly strip ALL remaining bracket tags so none ever leak to the user
  cleanText = cleanText.replace(/\[.*?\]/g, '');

  // Clean markdown formatting symbols (*, _, #, ~, `)
  cleanText = cleanText.replace(/[*_#~`]/g, '');

  // Normalize whitespace and clean dangling punctuation at the start/end
  cleanText = cleanText.replace(/\s+/g, ' ').replace(/^[\s,.:;!-]+/, '').trim();

  return {
    raw: rawText,
    speechText: cleanText,
    emotion: emotions[0] || (actions.includes('wave') || actions.includes('happy') ? 'happy' : null),
    action: actions[0] || null
  };
}
