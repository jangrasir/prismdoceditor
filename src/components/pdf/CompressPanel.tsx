import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Save } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob, formatBytes } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas, canvasToBlob } from "@/lib/pdfRenderer";

type Props = { files: { file: File; pageCount: number }[] };
type Quality = "low" | "medium" | "high";

const QUALITY_MAP: Record<Quality, { scale: number; jpeg: number }> = {
  low: { scale: 1.0, jpeg: 0.5 },
  medium: { scale: 1.4, jpeg: 0.7 },
  high: { scale: 1.8, jpeg: 0.85 },
};

export default function CompressPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState<Quality>("medium");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{ before: number; after: number } | null>(null);

  const run = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setBusy(true);
    setProgress(0);
    setStats(null);
    try {
      const file = files[0].file;
      const before = file.size;
      const { scale, jpeg } = QUALITY_MAP[quality];

      const pdf = await loadPdfDoc(file);
      const out = await PDFDocument.create();
      const total = pdf.numPages;

      for (let i = 1; i <= total; i++) {
        const canvas = await renderPageToCanvas(pdf, i, scale);
        const blob = await canvasToBlob(canvas, "image/jpeg", jpeg);
        const ab = await blob.arrayBuffer();
        const img = await out.embedJpg(ab);
        const page = out.addPage([canvas.width, canvas.height]);
        page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        setProgress(Math.round((i / total) * 100));
      }

      const bytes = await out.save({ useObjectStreams: true });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const after = blob.size;
      setStats({ before, after });

      const name = `compressed-${file.name}`;
      downloadBlob(blob, name);
      const saved = Math.max(0, Math.round((1 - after / before) * 100));
      if (user) await uploadAndRecord(user.id, blob, name, "pdf", "compress", `${quality} · ${saved}% saved`);
      toast.success(`Compressed (${saved}% smaller)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Compress PDF</h3>
        <p className="text-sm text-muted-foreground">Rasterizes pages as JPEG to shrink file size.</p>
      </div>
      <div className="max-w-xs space-y-1">
        <Label>Quality</Label>
        <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low (smallest file)</SelectItem>
            <SelectItem value="medium">Medium (balanced)</SelectItem>
            <SelectItem value="high">High (best quality)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {busy && <Progress value={progress} />}
      {stats && (
        <p className="text-sm text-muted-foreground">
          {formatBytes(stats.before)} → <span className="text-foreground font-medium">{formatBytes(stats.after)}</span>
          {" "}({Math.round((1 - stats.after / stats.before) * 100)}% saved)
        </p>
      )}
      <Button onClick={run} disabled={busy || files.length !== 1} className="bg-gradient-primary hover:opacity-90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Compress & download
      </Button>
    </Card>
  );
}
