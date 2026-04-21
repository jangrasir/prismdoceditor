import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Image as ImageIcon,
  Upload,
  History as HistoryIcon,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { FileRecord, formatBytes, downloadFile } from "@/lib/files";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, size: 0, last7: 0 });
  const [loading, setLoading] = useState(true);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setFiles((data ?? []) as FileRecord[]);

      const { data: all } = await supabase
        .from("files")
        .select("size_bytes, created_at, type")
        .eq("user_id", user.id);
      const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const last7 = (all ?? []).filter((f) => new Date(f.created_at).getTime() > week).length;
      const size = (all ?? []).reduce((s, f) => s + (f.size_bytes ?? 0), 0);
      setStats({ total: all?.length ?? 0, size, last7 });
      setLoading(false);
    })();
  }, [user]);

  const fetchAiTip = async () => {
    if (!user) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest", {
        body: { userId: user.id },
      });
      if (error) throw error;
      setAiTip(data?.suggestion ?? "Upload a few files to get personalized tips!");
    } catch (e: any) {
      toast.error(e?.message ?? "AI is busy, try again");
    } finally {
      setAiLoading(false);
    }
  };

  const quickActions = [
    { to: "/pdf-tools", label: "PDF Tools", desc: "Merge, split, reorder", icon: FileText, color: "from-primary to-primary-glow" },
    { to: "/image-tools", label: "Image Tools", desc: "Crop, resize, compress", icon: ImageIcon, color: "from-accent to-primary" },
    { to: "/history", label: "History", desc: "Browse past edits", icon: HistoryIcon, color: "from-primary-glow to-accent" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your files.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : [
              { label: "Total files", value: stats.total, icon: Upload },
              { label: "Storage used", value: formatBytes(stats.size), icon: TrendingUp },
              { label: "Last 7 days", value: stats.last7, icon: HistoryIcon },
            ].map((s) => (
              <Card key={s.label} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-3xl font-display font-bold mt-1">{s.value}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-soft flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </Card>
            ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to}>
              <Card className="p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${a.color} mb-3 shadow-glow`}>
                  <a.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-semibold">{a.label}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{a.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* AI tip */}
      <Card className="p-6 bg-gradient-soft border-primary/20">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">AI Suggestion</h3>
            <p className="text-sm text-muted-foreground">
              {aiTip ?? "Get a personalized recommendation based on your activity."}
            </p>
          </div>
          <Button onClick={fetchAiTip} disabled={aiLoading} variant="outline" size="sm">
            {aiLoading ? "Thinking..." : aiTip ? "Refresh" : "Get tip"}
          </Button>
        </div>
      </Card>

      {/* Recent files */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Recent files</h2>
          <Link to="/history" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        {loading ? (
          <Skeleton className="h-32" />
        ) : files.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <p className="text-muted-foreground mb-4">No files yet. Start with one of the tools above.</p>
            <Link to="/pdf-tools">
              <Button className="bg-gradient-primary hover:opacity-90">Try PDF tools</Button>
            </Link>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-gradient-soft flex items-center justify-center shrink-0">
                  {f.type.includes("pdf") ? (
                    <FileText className="h-5 w-5 text-primary" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(f.size_bytes)} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => downloadFile(f.storage_path, f.name)}>
                  Download
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
