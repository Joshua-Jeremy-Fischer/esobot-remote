import { useState, useRef } from "react";
import { Mic, MicOff, MicOff as MicBlocked } from "lucide-react";

export default function VoiceButton({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef(null);

  const toggleVoice = async () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUnsupported(true);
      return;
    }

    // Mic-Permission explizit anfragen
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setUnsupported(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setListening(false);
    };

    recognition.onerror = (e) => {
      console.warn("[Voice] SpeechRecognition error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setUnsupported(true);
      setListening(false);
    };
    recognition.onend = () => {
      console.log("[Voice] SpeechRecognition ended");
      setListening(false);
    };

    recognition.start();
    setListening(true);
  };

  if (unsupported) return null;

  return (
    <button
      onClick={toggleVoice}
      title={listening ? "Aufnahme stoppen" : "Spracheingabe"}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all ${
        listening
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-secondary text-muted-foreground active:scale-95"
      }`}
    >
      {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}