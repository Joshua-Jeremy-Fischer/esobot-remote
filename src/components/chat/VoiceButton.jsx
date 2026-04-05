import { useState, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

export default function VoiceButton({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Spracherkennung wird in diesem Browser nicht unterstützt.");
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

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognition.start();
    setListening(true);
  };

  return (
    <button
      onClick={toggleVoice}
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