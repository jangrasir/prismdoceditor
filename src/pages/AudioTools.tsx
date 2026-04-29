import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Upload, Music2, X, Loader2, Save, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob, formatBytes } from "@/lib/files";
import {
  decodeAudioFile,
  trimBuffer,
  mergeBuffers,
  applyGain,
  applyFades,
  normalizeBuffer,
  audioBufferToWav,
  formatTime,
} from "@/lib/audio";

type Track = { file: File; buffer: AudioBuffer };

export default function AudioTools() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    const next: Track[] = [];
    for (const f of accepted) {
      if (!f.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i.test(f.name)) {
        toast.error(`${f.name} is not audio`);
        continue;
      }
      try {
        const buffer = await decodeAudioFile(f);
        next.push({ file: f, buffer });
      } catch {
        toast.error(`Couldn't decode ${f.name}`);
      }
    }
    setTracks((p) => [...p, ...next]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "audio/*": [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".webm"] },
  });

  const removeTrack = (i: number) => setTracks((p) => p.filter((_, idx) => idx !== i));

  const saveOutput = async (blob: Blob, name: string, action: string, details?: string) => {
    downloadBlob(blob, name);
    if (user) {
      try {
        await uploadAndRecord(user.id, blob, name, "audio", action, details);
        toast.success("Saved to your library");
      } catch (e: any) {
        toast.error("Saved locally — couldn't save to library: " + (e?.message ?? "error"));
      }
    }
  };

  // ── Trim ───────────────────────────────────────
  const [trimIdx, setTrimIdx] = useState(0);
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("0");

  const handleTrim = async () => {
    const t = tracks[trimIdx];
    if (!t) return toast.error("Add an audio file");
    const s = parseFloat(trimStart);
    const e = parseFloat(trimEnd) || t.buffer.duration;
    if (isNaN(s) || s < 0 || e <= s) return toast.error("Invalid range");
    setBusy(true);
    try {
      const out = trimBuffer(t.buffer, s, Math.min(e, t.buffer.duration));
      const blob = audioBufferToWav(out);
      const base = t.file.name.replace(/\.[^.]+$/, "");
      await saveOutput(blob, `${base}-trim.wav`, "audio_trim", `${s.toFixed(2)}s–${e.toFixed(2)}s`);
    } catch (e: any) {
      toast.error(e?.message ?? "Trim failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Merge ──────────────────────────────────────
  const handleMerge = async () => {
    if (tracks.length < 2) return toast.error("Add at least 2 audio files");
    setBusy(true);
    try {
      const out = mergeBuffers(tracks.map((t) => t.buffer));
      const blob = audioBufferToWav(out);
      await saveOutput(blob, `merged-${Date.now()}.wav`, "audio_merge", `${tracks.length} clips`);
    } catch (e: any) {
      toast.error(e?.message ?? "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Volume / Fades / Normalize ─────────────────
  const [editIdx, setEditIdx] = useState(0);
  const [gainPct, setGainPct] = useState([100]);
  const [fadeIn, setFadeIn] = useState("0");
  const [fadeOut, setFadeOut] = useState("0");
  const [doNormalize, setDoNormalize] = useState(false);

  const handleEdit = async () => {
    const t = tracks[editIdx];
    if (!t) return toast.error("Add an audio file");
    setBusy(true);
    try {
      let out = t.buffer;
      if (doNormalize) out = normalizeBuffer(out);
      const g = (gainPct[0] ?? 100) / 100;
      if (g !== 1) out = applyGain(out, g);
      const fi = parseFloat(fadeIn) || 0;
      const fo = parseFloat(fadeOut) || 0;
      if (fi > 0 || fo > 0) out = applyFades(out, fi, fo);
      const blob = audioBufferToWav(out);
      const base = t.file.name.replace(/\.[^.]+$/, "");
      await saveOutput(
        blob,
        `${base}-edited.wav`,
        "audio_edit",
        `gain ${gainPct[0]}%, fadeIn ${fi}s, fadeOut ${fo}s${doNormalize ? ", normalized" : ""}`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Edit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Audio Tools</h1>
        <p className="text-muted-foreground mt-1">
          Trim, merge, adjust volume, fade, and normalize — all in your browser.
        </p>
      </div>

      <Card
        {...getRootProps()}
        className={`p-8 border-2 border-dashed cursor-pointer transition-all ${
          isDragActive ? "border-primary bg-gradient-soft" : "border-border hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Upload className="h-5 w-5 text-primary-foreground" />
          </div>
          <p className="font-medium">{isDragActive ? "Drop here…" : "Drop audio or click to browse"}</p>
          <p className="text-xs text-muted-foreground">MP3, WAV, OGG, M4A, FLAC, AAC. Files stay on your device.</p>
        </div>
      </Card>

      {tracks.length > 0 && (
        <Card className="p-4 space-y-2">
          {tracks.map((t, i) => (
            <TrackRow key={i} track={t} index={i} onRemove={() => removeTrack(i)} />
          ))}
        </Card>
      )}

      <Tabs defaultValue="trim" className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="trim">Trim / Cut</TabsTrigger>
            <TabsTrigger value="merge">Merge</TabsTrigger>
            <TabsTrigger value="edit">Volume &amp; Fades</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="trim">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Trim or cut a section</h3>
              <p className="text-sm text-muted-foreground">Keep audio between start and end (in seconds).</p>
            </div>

            <TrackPicker tracks={tracks} value={trimIdx} onChange={setTrimIdx} />

            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1">
                <Label htmlFor="ts">Start (sec)</Label>
                <Input id="ts" type="number" min="0" step="0.1" value={trimStart} onChange={(e) => setTrimStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="te">End (sec)</Label>
                <Input id="te" type="number" min="0" step="0.1" value={trimEnd} onChange={(e) => setTrimEnd(e.target.value)} />
              </div>
            </div>

            <Button onClick={handleTrim} disabled={busy || tracks.length === 0} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Trim &amp; download
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="merge">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Merge clips</h3>
              <p className="text-sm text-muted-foreground">Joins all uploaded clips end-to-end in order.</p>
            </div>
            <Button onClick={handleMerge} disabled={busy || tracks.length < 2} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Merge &amp; download
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="edit">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Volume, fades &amp; normalize</h3>
              <p className="text-sm text-muted-foreground">Apply gain, fade in/out, and peak normalization.</p>
            </div>

            <TrackPicker tracks={tracks} value={editIdx} onChange={setEditIdx} />

            <div className="space-y-2 max-w-md">
              <Label>Volume: {gainPct[0]}%</Label>
              <Slider value={gainPct} onValueChange={setGainPct} min={0} max={300} step={5} />
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1">
                <Label htmlFor="fi">Fade in (sec)</Label>
                <Input id="fi" type="number" min="0" step="0.1" value={fadeIn} onChange={(e) => setFadeIn(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fo">Fade out (sec)</Label>
                <Input id="fo" type="number" min="0" step="0.1" value={fadeOut} onChange={(e) => setFadeOut(e.target.value)} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={doNormalize}
                onChange={(e) => setDoNormalize(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Normalize peak to -0.1 dB
            </label>

            <Button onClick={handleEdit} disabled={busy || tracks.length === 0} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Apply &amp; download
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TrackPicker({
  tracks,
  value,
  onChange,
}: {
  tracks: Track[];
  value: number;
  onChange: (n: number) => void;
}) {
  if (tracks.length === 0) return null;
  return (
    <div className="space-y-1 max-w-md">
      <Label>Source clip</Label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      >
        {tracks.map((t, i) => (
          <option key={i} value={i}>
            {t.file.name} ({formatTime(t.buffer.duration)})
          </option>
        ))}
      </select>
    </div>
  );
}

function TrackRow({ track, index, onRemove }: { track: Track; index: number; onRemove: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const url = useMemo(() => URL.createObjectURL(track.file), [track.file]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
      <Music2 className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          <span className="text-muted-foreground mr-1">#{index + 1}</span>
          {track.file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(track.file.size)} · {formatTime(track.buffer.duration)} ·{" "}
          {track.buffer.numberOfChannels}ch · {track.buffer.sampleRate}Hz
        </p>
      </div>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Play/Pause">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
        <X className="h-4 w-4" />
      </Button>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}
