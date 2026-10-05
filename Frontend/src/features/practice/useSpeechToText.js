import { useCallback, useEffect, useRef, useState } from "react";

const ERRORS = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser to answer out loud.",
  "service-not-allowed": "Speech recognition isn't available in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection."
};

const getRecognition = () =>
  typeof window === "undefined" ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null;

/**
 * Browser speech-to-text (Chrome/Edge). Finished phrases are passed to
 * onFinal; the phrase still being spoken is exposed as `interim`.
 */
export function useSpeechToText({ onFinal }) {
  const [supported] = useState(() => Boolean(getRecognition()));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const start = useCallback(() => {
    const Recognition = getRecognition();
    if (!Recognition || recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) onFinalRef.current?.(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(ERRORS[event.error] || "Speech recognition stopped unexpectedly.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };

    setError("");
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
