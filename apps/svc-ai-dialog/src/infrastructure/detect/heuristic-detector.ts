import { MistakeDetector } from '../../domain/ports/mistake.detector';
import { Mistake } from '../../domain/mistake';

const BAD_FORMS: Record<
  string,
  { term: string; kind: Mistake['kind']; hint: string }
> = {
  goed: {
    term: 'went',
    kind: 'grammar',
    hint: "Irregular past of 'go' is 'went'.",
  },
  forgetted: {
    term: 'forgot',
    kind: 'grammar',
    hint: "Irregular past of 'forget' is 'forgot'.",
  },
  buyed: {
    term: 'bought',
    kind: 'grammar',
    hint: "Irregular past of 'buy' is 'bought'.",
  },
  catched: {
    term: 'caught',
    kind: 'grammar',
    hint: "Irregular past of 'catch' is 'caught'.",
  },
  teached: {
    term: 'taught',
    kind: 'grammar',
    hint: "Irregular past of 'teach' is 'taught'.",
  },
};

const VOCAB: Record<string, { term: string; hint: string }> = {
  fly: { term: 'flight', hint: "Use the noun 'flight' for a plane journey." },
  informations: {
    term: 'information',
    hint: "'information' is uncountable — no plural.",
  },
  advices: { term: 'advice', hint: "'advice' is uncountable — no plural." },
  peoples: { term: 'people', hint: "'people' is already plural." },
};

const PAST_MARKERS = new Set(['yesterday', 'ago']);
const BASE_AFTER_PAST: Record<string, string> = {
  go: 'went',
  miss: 'missed',
  eat: 'ate',
  see: 'saw',
  take: 'took',
  make: 'made',
  is: 'was',
  are: 'were',
  have: 'had',
};
const THIRD_SINGULAR = new Set(['he', 'she', 'it']);
const NON_THIRD = new Set(['i', 'you', 'we', 'they']);

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[.,!?;:"']+|[.,!?;:"']+$/g, '').toLowerCase())
    .filter(Boolean);
}

export class HeuristicDetector implements MistakeDetector {
  detect(userText: string): Mistake[] {
    const text = userText.trim();
    const words = tokenize(text);
    const mistakes: Mistake[] = [];
    const seen = new Set<string>();

    const add = (term: string, kind: Mistake['kind'], hint: string) => {
      if (seen.has(term)) return;
      seen.add(term);
      mistakes.push({ term, kind, context: text, translation: hint });
    };

    for (const w of words) {
      if (BAD_FORMS[w])
        add(BAD_FORMS[w].term, BAD_FORMS[w].kind, BAD_FORMS[w].hint);
      if (VOCAB[w]) add(VOCAB[w].term, 'vocabulary', VOCAB[w].hint);
    }

    if (words.some((w) => PAST_MARKERS.has(w))) {
      for (const w of words) {
        if (BASE_AFTER_PAST[w]) {
          add(
            BASE_AFTER_PAST[w],
            'grammar',
            `Past-time context: use '${BASE_AFTER_PAST[w]}'.`,
          );
        }
      }
    }

    for (let i = 0; i < words.length - 1; i++) {
      const w = words[i];
      const next = words[i + 1];
      if (THIRD_SINGULAR.has(w) && next === "don't") {
        add("doesn't", 'grammar', "Third-person singular takes 'doesn't'.");
      }
      if (NON_THIRD.has(w) && next === "doesn't") {
        add("don't", 'grammar', `Use 'don't' with '${w}'.`);
      }
    }

    return mistakes;
  }
}
