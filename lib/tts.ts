"use client";

export function speakHindi(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "hi-IN";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  // Prefer hi-IN voice if available
  const voices = window.speechSynthesis.getVoices();
  const hindiVoice = voices.find(
    (v) => v.lang === "hi-IN" || v.lang.startsWith("hi")
  );
  if (hindiVoice) utterance.voice = hindiVoice;

  window.speechSynthesis.speak(utterance);
}

export function speakEnglish(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
