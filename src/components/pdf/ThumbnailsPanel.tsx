import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Images, Download as DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas, canvasToBlob } from "@/lib/pdfRenderer";

type SelectedFile = { file: File; pageCount: number };

export default function ThumbnailsPanel({ files }: { files: SelectedFile[] }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<{ page: number; url: string }[]>([]);
  const [scale, setScale] = useState(0.4);

  const generate = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setBusy(true);
    setThumbs([]);
    try {
      const pdf = await loadPdfDoc(files[0].file);
      const out: { page: number; url: string }[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const canvas = await renderPageToCanvas(pdf, i, scale);
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.8);
        out.push({ page: i, url: URL.createObjectURL(blob) });
        setThumbs([...out]);
      }
      toast.success(`Generated ${out.length} thumbnails`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadOne = async (page: number) => {
    if (files.length !== 1) return;
    const pdf = await loadPdfDoc(files[0].file);
    const canvas = await renderPageToCanvas(pdf, page, 2);
    const blob = await canvasToBlob(canvas, "image/png");
    const name = `${files[0].file.name.replace(/\.pdf$/i, "")}-page-${page}.png`;
    downloadBlob(blob, name);
    if (user) {
      try {
        await uploadAndRecord(user.id, blob, name, "pdf", "thumbnail", `page ${page}`);
      } catch {}
    }
  };

  const downloadAllZip = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const pdf = await loadPdfDoc(files[0].file);
      for (let i = 1; i <= pdf.numPages; i++) {
        const canvas = await renderPageToCanvas(pdf, i, 1.5);
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
        zip.file(`page-${String(i).padStart(3, "0")}.jpg`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const name = `${files[0].file.name.replace(/\.pdf$/i, "")}-thumbnails.zip`;
      downloadBlob(out, name);
      if (user) {
        try {
          await uploadAndRecord(user.id, out, name, "pdf", "thumbnails", `${pdf.numPages} pages`);
          toast.success("Saved to library");
        } catch {}
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="font-display text-lg font-semibold mb-2">PDF Thumbnails</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Preview every page as an image grid. Click a thumbnail to download it as PNG.
      </p>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="space-y-1">
          <Label htmlFor="scale">Preview scale</Label>
          <Input
            id="scale"
            type="number"
            min={0.2}
            max={1}
            step={0.1}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value) || 0.4)}
            className="w-28"
          />
        </div>
        <Button onClick={generate} disabled={busy || files.length !== 1} className="bg-gradient-primary hover:opacity-90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Images className="h-4 w-4 mr-2" />}
          Generate
        </Button>
        <Button onClick={downloadAllZip} disabled={busy || files.length !== 1} variant="outline">
          <DownloadIcon className="h-4 w-4 mr-2" />
          Download all (ZIP)
        </Button>
      </div>

      {thumbs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[600px] overflow-auto p-1">
          {thumbs.map((t) => (
            <button
              key={t.page}
              onClick={() => downloadOne(t.page)}
              className="group relative border border-border rounded-lg overflow-hidden hover:border-primary hover:shadow-glow transition-all bg-muted/20"
              title={`Download page ${t.page} as PNG`}
            >
              <img src={t.url} alt={`Page ${t.page}`} className="w-full h-auto block" />
              <span className="absolute bottom-1 right-1 bg-background/80 backdrop-blur px-2 py-0.5 rounded text-xs font-medium">
                {t.page}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
