import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Image as ImageIcon, Search, Trash2, Download } from "lucide-react";
import { FileRecord, formatBytes, downloadFile, deleteFile } from "@/lib/files";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function HistoryPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setFiles((data ?? []) as FileRecord[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleDelete = async (f: FileRecord) => {
    if (!confirm(`Delete "${f.name}"?`)) return;
    try {
      await deleteFile(f.id, f.storage_path);
      setFiles((p) => p.filter((x) => x.id !== f.id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  const filtered = files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">History</h1>
        <p className="text-muted-foreground mt-1">All files you've uploaded or generated.</p>
      </div>

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
          {filtered.map((f) => (
            <div key={f.id} className="flex items-center gap-4 p-4">
              <div className="h-11 w-11 rounded-lg bg-gradient-soft flex items-center justify-center shrink-0">
                {f.type.includes("pdf") ? (
                  <FileText className="h-5 w-5 text-primary" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-primary" />
                )}
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
                  {formatBytes(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })} · {format(new Date(f.created_at), "PP")}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => downloadFile(f.storage_path, f.name)} aria-label="Download">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(f)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
