/**
 * Text-to-Speech utility for queue announcements.
 * Uses the Web Speech API for browser-native TTS.
 */

let isSpeaking = false;

function speakMessage(text: string): void {
  if (!("speechSynthesis" in window)) {
    console.warn("Text-to-speech is not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume?.();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  utterance.lang = "en-US";

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha")
  );
  if (preferred) {
    utterance.voice = preferred;
  }

  utterance.onstart = () => { isSpeaking = true; };
  utterance.onend = () => { isSpeaking = false; };
  utterance.onerror = () => { isSpeaking = false; };

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 100);
}

export function announceMessage(message: string): void {
  speakMessage(message);
}

export function announceNextInQueue(tokenNumber: string, position?: number): void {
  const queuePart = typeof position === "number" ? ` It is number ${position} in line.` : "";
  speakMessage(`Attention please. Next in queue is token ${tokenNumber}.${queuePart}`);
}

export function announceToken(tokenNumber: string, counterNumber?: number | string): void {
  const counterPart = counterNumber ? `, please proceed to Counter ${counterNumber}` : "";
  const text = `Attention please. Token number ${tokenNumber.split("").join(" ")}${counterPart}. Thank you.`;

  speakMessage(text);
}

export function playChime(): void {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a pleasant two-tone chime
    const notes = [880, 1100]; // A5, C#6

    notes.forEach((freq, i) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);

      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.8);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start(audioCtx.currentTime + i * 0.15);
      oscillator.stop(audioCtx.currentTime + i * 0.15 + 0.8);
    });
  } catch (e) {
    console.warn("Audio chime failed:", e);
  }
}

export function isTTSAvailable(): boolean {
  return "speechSynthesis" in window;
}

export function isCurrentlySpeaking(): boolean {
  return isSpeaking;
}

/**
 * Browsers block audio until a user gesture.
 * Call this function on the first click/interaction to "unlock" AudioContext and SpeechSynthesis.
 */
export function unlockAudio(): void {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtx.resume?.();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(0);
    oscillator.stop(0.1);
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance("");
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn("Audio unlock failed", e);
  }
}

