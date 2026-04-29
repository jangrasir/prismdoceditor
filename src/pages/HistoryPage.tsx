import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Image as ImageIcon,
  Music2,
  Search,
  Trash2,
  Download,
  Play,
  Pause,
  Activity,
} from "lucide-react";
import { FileRecord, HistoryRecord, formatBytes, downloadFile, deleteFile } from "@/lib/files";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type AudioOp = HistoryRecord & { file?: FileRecord | null };

const ACTION_LABELS: Record<string, string> = {
  audio_trim: "Trimmed audio",
  audio_merge: "Merged audio",
  audio_edit: "Edited audio (volume / fades)",
};

function fileIcon(type: string) {
  if (type.includes("pdf")) return <FileText className="h-5 w-5 text-primary" />;
  if (type === "audio" || type.startsWith("audio")) return <Music2 className="h-5 w-5 text-primary" />;
  return <ImageIcon className="h-5 w-5 text-primary" />;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [audioOps, setAudioOps] = useState<AudioOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [filesRes, histRes] = await Promise.all([
      supabase.from("files").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("history")
        .select("*")
        .eq("user_id", user.id)
        .in("action", ["audio_trim", "audio_merge", "audio_edit"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const fileList = (filesRes.data ?? []) as FileRecord[];
    setFiles(fileList);
    const fileMap = new Map(fileList.map((f) => [f.id, f]));
    setAudioOps(
      ((histRes.data ?? []) as HistoryRecord[]).map((h) => ({ ...h, file: h.file_id ? fileMap.get(h.file_id) ?? null : null }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDelete = async (f: FileRecord) => {
    if (!confirm(`Delete "${f.name}"?`)) return;
    try {
      await deleteFile(f.id, f.storage_path);
      setFiles((p) => p.filter((x) => x.id !== f.id));
      setAudioOps((p) => p.filter((o) => o.file?.id !== f.id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  const ensurePreviewUrl = async (f: FileRecord) => {
    if (previewUrls[f.id]) return previewUrls[f.id];
    const { data, error } = await supabase.storage.from("user-files").createSignedUrl(f.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't load audio preview");
      return null;
    }
    setPreviewUrls((p) => ({ ...p, [f.id]: data.signedUrl }));
    return data.signedUrl;
  };

  const togglePlay = async (f: FileRecord) => {
    const url = await ensurePreviewUrl(f);
    if (!url) return;
    // Pause any other
    Object.entries(audioRefs.current).forEach(([id, el]) => {
      if (id !== f.id && el) el.pause();
    });
    const el = audioRefs.current[f.id];
    if (!el) return;
    if (playingId === f.id) {
      el.pause();
      setPlayingId(null);
    } else {
      try {
        await el.play();
        setPlayingId(f.id);
      } catch {
        /* ignore */
      }
    }
  };

  const filtered = useMemo(
    () => files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [files, query]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">History</h1>
        <p className="text-muted-foreground mt-1">
          All files you've uploaded or generated, plus recent audio operations.
        </p>
      </div>

      {/* Audio operations timeline */}
      {!loading && audioOps.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Recent audio operations</h2>
          </div>
          <Card className="divide-y divide-border">
            {audioOps.map((op) => {
              const f = op.file;
              const isPlaying = f && playingId === f.id;
              return (
                <div key={op.id} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-lg bg-gradient-soft flex items-center justify-center shrink-0">
                    <Music2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {ACTION_LABELS[op.action] ?? op.action}
                      </p>
                      {f && <Badge variant="secondary" className="text-xs">{f.name}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {op.details ? `${op.details} · ` : ""}
                      {formatDistanceToNow(new Date(op.created_at), { addSuffix: true })} ·{" "}
                      {format(new Date(op.created_at), "PPp")}
                    </p>
                    {f && previewUrls[f.id] && (
                      <audio
                        ref={(el) => { audioRefs.current[f.id] = el; }}
                        src={previewUrls[f.id]}
                        onEnded={() => setPlayingId(null)}
                        className="hidden"
                      />
                    )}
                  </div>
                  {f && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePlay(f)}
                        aria-label={isPlaying ? "Pause preview" : "Play preview"}
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadFile(f.storage_path, f.name)}
                        aria-label="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">{query ? "No matches." : "No files yet."}</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((f) => {
            const isAudio = f.type === "audio" || f.type.startsWith("audio") || (f.mime_type ?? "").startsWith("audio/");
            const isPlaying = playingId === f.id;
            return (
              <div key={f.id} className="flex items-center gap-4 p-4">
                <div className="h-11 w-11 rounded-lg bg-gradient-soft flex items-center justify-center shrink-0">
                  {fileIcon(f.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{f.name}</p>
                    <Badge variant="secondary" className="text-xs">{f.type}</Badge>
                    {f.ai_tags?.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatBytes(f.size_bytes)} ·{" "}
                    {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })} ·{" "}
                    {format(new Date(f.created_at), "PP")}
                  </p>
                  {isAudio && previewUrls[f.id] && (
                    <audio
                      ref={(el) => { audioRefs.current[f.id] = el; }}
                      src={previewUrls[f.id]}
                      onEnded={() => setPlayingId(null)}
                      className="mt-2 w-full max-w-sm"
                      controls
                    />
                  )}
                </div>
                {isAudio && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePlay(f)}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => downloadFile(f.storage_path, f.name)} aria-label="Download">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(f)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
