import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download as DownloadIcon } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas, canvasToBlob } from "@/lib/pdfRenderer";

type Props = { files: { file: File; pageCount: number }[] };

export default function ToImagesPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState<"72" | "150" | "300">("150");
  const [progress, setProgress] = useState(0);

  const run = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setBusy(true);
    setProgress(0);
    try {
      const file = files[0].file;
      const scale = parseInt(dpi, 10) / 72;
      const pdf = await loadPdfDoc(file);
      const zip = new JSZip();
      const ext = format === "png" ? "png" : "jpg";
      const mime = format === "png" ? "image/png" : "image/jpeg";

      for (let i = 1; i <= pdf.numPages; i++) {
        const canvas = await renderPageToCanvas(pdf, i, scale);
        const blob = await canvasToBlob(canvas, mime as "image/png" | "image/jpeg", 0.92);
        zip.file(`page-${String(i).padStart(3, "0")}.${ext}`, blob);
        setProgress(Math.round((i / pdf.numPages) * 100));
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const name = `${file.name.replace(/\.pdf$/i, "")}-images.zip`;
      downloadBlob(zipBlob, name);
      if (user) await uploadAndRecord(user.id, zipBlob, name, "pdf", "to-images", `${format.toUpperCase()} · ${dpi}dpi · ${pdf.numPages}p`);
      toast.success(`Exported ${pdf.numPages} pages`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">PDF → Images</h3>
        <p className="text-sm text-muted-foreground">Convert each page to PNG or JPG, downloaded as a ZIP.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 max-w-md">
        <div className="space-y-1">
          <Label>Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as "png" | "jpeg")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG (lossless)</SelectItem>
              <SelectItem value="jpeg">JPG (smaller)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Resolution</Label>
          <Select value={dpi} onValueChange={(v) => setDpi(v as "72" | "150" | "300")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="72">72 DPI (screen)</SelectItem>
              <SelectItem value="150">150 DPI (good)</SelectItem>
              <SelectItem value="300">300 DPI (print)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {busy && <Progress value={progress} />}
      <Button onClick={run} disabled={busy || files.length !== 1} className="bg-gradient-primary hover:opacity-90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DownloadIcon className="h-4 w-4 mr-2" />}
        Convert & download ZIP
      </Button>
    </Card>
  );
}
