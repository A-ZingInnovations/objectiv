/** Web Speech API helpers for LLM Suite STT / TTS (system mic + spoken replies). */

type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function speechRecognitionSupported(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      (window.SpeechRecognition ?? window.webkitSpeechRecognition),
  );
}

export function createSpeechRecognition(lang = 'en-US'): SpeechRecognition | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let speakToken = 0;

/** Stop any in-flight TTS and optionally speak plain text (markdown stripped lightly). */
export function speakAssistantReply(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
): void {
  if (!speechSynthesisSupported() || !text.trim()) return;
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/[#>*_\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
  if (!plain) return;

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(plain);
  utter.rate = 1;
  utter.pitch = 1;
  const token = ++speakToken;
  utter.onstart = () => onStart?.();
  utter.onend = () => {
    if (token === speakToken) onEnd?.();
  };
  utter.onerror = () => {
    if (token === speakToken) onEnd?.();
  };
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  speakToken++;
  window.speechSynthesis?.cancel();
}