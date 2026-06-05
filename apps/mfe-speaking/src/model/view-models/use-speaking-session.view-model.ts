import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api';
import { ServerFrame, SocketStatus, SpeakingSocket } from '../realtime-client';

const WS_BASE = (
  (process.env.BFF_URL as string) || 'http://localhost:3000'
).replace(/^http/, 'ws');

export interface Pronunciation {
  score: number;
  words: { word: string; score: number }[];
}

export interface CompletedTurn {
  user: string;
  ai: string;
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of candidates) if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export function useSpeakingSessionViewModel(accessToken: string) {
  const api = useApi();
  const scenariosQuery = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => api.listScenarios(),
  });

  const [scenario, setScenario] = useState<string | null>(null);
  const [status, setStatus] = useState<SocketStatus | 'idle'>('idle');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [pronunciation, setPronunciation] = useState<Pronunciation | null>(
    null,
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<CompletedTurn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<SpeakingSocket | null>(null);
  const scenarioRef = useRef<string | null>(null);
  const transcriptRef = useRef('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const onFrame = useCallback((frame: ServerFrame) => {
    switch (frame.type) {
      case 'ready':
        socketRef.current?.start(
          scenarioRef.current ?? 'small_talk',
          frame.sessionId,
        );
        break;
      case 'transcript':
        transcriptRef.current = frame.text;
        setTranscript(frame.text);
        break;
      case 'pronunciation':
        setPronunciation({ score: frame.score, words: frame.words });
        break;
      case 'ai-token':
        setAiReply((prev) => prev + frame.delta);
        break;
      case 'ai-done':
        setProcessing(false);
        setHistory((h) => [
          ...h,
          { user: transcriptRef.current, ai: frame.text },
        ]);
        break;
      case 'ai-audio':
        setAudioUrl(frame.url);
        break;
      case 'error':
        setError(frame.message);
        setProcessing(false);
        break;
    }
  }, []);

  const selectScenario = useCallback(
    (id: string) => {
      setScenario(id);
      scenarioRef.current = id;
      setHistory([]);
      setError(null);
      const url = `${WS_BASE}/realtime/speaking?token=${encodeURIComponent(accessToken)}`;
      const socket = new SpeakingSocket(url, onFrame, setStatus);
      socket.connect();
      socketRef.current = socket;
    },
    [accessToken, onFrame],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setTranscript('');
        transcriptRef.current = '';
        setAiReply('');
        setPronunciation(null);
        setAudioUrl(null);
        setError(null);
        setProcessing(true);
        socketRef.current?.sendAudio(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Microphone access was denied.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else void startRecording();
  }, [recording, startRecording, stopRecording]);

  const leave = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScenario(null);
    scenarioRef.current = null;
    setStatus('idle');
    setRecording(false);
    setProcessing(false);
    setTranscript('');
    setAiReply('');
    setPronunciation(null);
    setAudioUrl(null);
  }, []);

  useEffect(
    () => () => {
      socketRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return {
    scenarios: scenariosQuery.data ?? [],
    scenariosLoading: scenariosQuery.isLoading,
    scenariosError: scenariosQuery.error ? String(scenariosQuery.error) : null,
    scenario,
    connected: status === 'open',
    status,
    recording,
    processing,
    transcript,
    aiReply,
    pronunciation,
    audioUrl,
    history,
    error,
    selectScenario,
    toggleRecording,
    leave,
  };
}
