import { useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
const MAX_BYTES = 850000; // stop early if the file gets close to the storage limit

// Minimal types for the browser's speech recognition (not in TypeScript's default types)
interface SpeechAlt {
  transcript: string;
}
interface SpeechRes {
  isFinal: boolean;
  [index: number]: SpeechAlt;
}
interface SpeechEvent {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRes };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface Recording {
  blob: Blob;
  url: string;
  seconds: number;
}

export function useRecorder(maxSeconds: number, onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<Recording | null>(null);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const resultRef = useRef<Recording | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const finalTextRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  const supportsSpeech = typeof window !== "undefined" && recognitionCtor() !== undefined;

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopSpeech() {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    }
  }

  function startSpeech() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    finalTextRef.current = "";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTextRef.current += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      onTranscriptRef.current((finalTextRef.current + interim).trim());
    };
    rec.onerror = () => {};
    rec.onend = () => {
      // The browser stops listening after a pause; keep going while we're recording
      if (recognitionRef.current === rec && recorderRef.current?.state === "recording") {
        try {
          rec.start();
        } catch {
          // ignore
        }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // ignore
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function start() {
    setError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording isn't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 24000, // small files: voice doesn't need more
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearTimer();
        stopSpeech();

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mime || "audio/webm",
        });
        if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
        const next: Recording = {
          blob,
          url: URL.createObjectURL(blob),
          seconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
        };
        resultRef.current = next;
        setResult(next);
        setRecording(false);
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(1000);
      setRecording(true);
      setSeconds(0);

      timerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(s);
        const bytes = chunksRef.current.reduce((n, c) => n + c.size, 0);
        if (s >= maxSeconds || bytes > MAX_BYTES) stop();
      }, 250);

      startSpeech();
    } catch {
      setError("Couldn't use the microphone. Check that you allowed it in your browser.");
    }
  }

  function discard() {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = null;
    setResult(null);
  }

  // Clean up if the page is closed mid-recording
  useEffect(() => {
    return () => {
      clearTimer();
      stopSpeech();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  return { recording, seconds, result, error, supportsSpeech, start, stop, discard };
}
