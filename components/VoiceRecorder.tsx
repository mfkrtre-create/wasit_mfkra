"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Play, Send, Square, Trash2 } from "lucide-react";

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const supportedTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function VoiceRecorder({
  onTranscribe,
  disabled,
}: {
  onTranscribe: (file: File) => Promise<void>;
  disabled: boolean;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  async function startRecording() {
    setError(null);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("المتصفح لا يدعم تسجيل الصوت.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder غير مدعوم في هذا المتصفح.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }
          return URL.createObjectURL(blob);
        });
        stream.getTracks().forEach((track) => track.stop());
      };

      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
      setIsRecording(true);
      recorder.start();
      timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000);
    } catch {
      setError("تعذر الوصول إلى الميكروفون. اسمح بالوصول ثم حاول مرة أخرى.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function deleteRecording() {
    if (isRecording) {
      stopRecording();
    }

    chunksRef.current = [];
    setAudioBlob(null);
    setDuration(0);
    setAudioUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });
    setError(null);
  }

  async function sendRecording() {
    if (!audioBlob) {
      setError("لا يوجد تسجيل لإرساله.");
      return;
    }

    const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([audioBlob], `arabic-property-recording.${extension}`, {
      type: audioBlob.type || "audio/webm",
    });

    await onTranscribe(file);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">تسجيل رسالة صوتية</h2>
        <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-sm text-slate-700" dir="ltr">
          {formatDuration(duration)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled || isRecording}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800"
        >
          <Mic className="size-4" aria-hidden="true" />
          بدء التسجيل
        </button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={!isRecording}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-rose-700 px-4 text-sm font-bold text-white transition hover:bg-rose-800"
        >
          <Square className="size-4" aria-hidden="true" />
          إيقاف التسجيل
        </button>
        <button
          type="button"
          onClick={deleteRecording}
          disabled={disabled || (!audioBlob && !isRecording)}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          حذف التسجيل
        </button>
        <button
          type="button"
          onClick={sendRecording}
          disabled={disabled || !audioBlob || isRecording}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-orange-700 px-4 text-sm font-bold text-white transition hover:bg-orange-800"
        >
          <Send className="size-4" aria-hidden="true" />
          إرسال للتفريغ
        </button>
      </div>

      {audioUrl ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Play className="size-4" aria-hidden="true" />
            الاستماع إلى التسجيل
          </div>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
