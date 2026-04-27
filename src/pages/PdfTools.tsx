import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Loader2, Save, Download as DownloadIcon, GripVertical } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob, formatBytes } from "@/lib/files";
import CompressPanel from "@/components/pdf/CompressPanel";
import ToImagesPanel from "@/components/pdf/ToImagesPanel";
import WatermarkPanel from "@/components/pdf/WatermarkPanel";
import OcrPanel from "@/components/pdf/OcrPanel";
import EncryptPanel from "@/components/pdf/EncryptPanel";
import HeaderFooterPanel from "@/components/pdf/HeaderFooterPanel";
import RedactPanel from "@/components/pdf/RedactPanel";
import SignPanel from "@/components/pdf/SignPanel";
import ThumbnailsPanel from "@/components/pdf/ThumbnailsPanel";
import EditPanel from "@/components/pdf/EditPanel";

type SelectedFile = { file: File; pageCount: number };

export default function PdfTools() {
  const { user } = useAuth();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    const next: SelectedFile[] = [];
    for (const f of accepted) {
      if (f.type !== "application/pdf") {
        toast.error(`${f.name} is not a PDF`);
        continue;
      }
      try {
        const buf = await f.arrayBuffer();
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        next.push({ file: f, pageCount: doc.getPageCount() });
      } catch {
        toast.error(`Couldn't read ${f.name}`);
      }
    }
    setFiles((p) => [...p, ...next]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
  });

  const removeFile = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i));

  const saveBlob = async (blob: Blob, name: string, action: string, details?: string) => {
    downloadBlob(blob, name);
    if (user) {
      try {
        await uploadAndRecord(user.id, blob, name, "pdf", action, details);
        toast.success("Saved to your library");
      } catch (e: any) {
        toast.error("Saved locally — couldn't save to library: " + (e?.message ?? "error"));
      }
    }
  };

  // ── Merge ───────────────────────────────────────
  const handleMerge = async () => {
    if (files.length < 2) return toast.error("Add at least 2 PDFs");
    setBusy(true);
    try {
      const merged = await PDFDocument.create();
      for (const { file } of files) {
        const buf = await file.arrayBuffer();
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      await saveBlob(blob, `merged-${Date.now()}.pdf`, "merge", `${files.length} files`);
    } catch (e: any) {
      toast.error(e?.message ?? "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Split ───────────────────────────────────────
  const [splitRange, setSplitRange] = useState("1-1");

  const parseRange = (str: string, max: number): number[] => {
    const out = new Set<number>();
    for (const part of str.split(",").map((s) => s.trim())) {
      if (!part) continue;
      if (part.includes("-")) {
        const [a, b] = part.split("-").map((n) => parseInt(n, 10));
        if (!a || !b) continue;
        for (let i = Math.max(1, a); i <= Math.min(max, b); i++) out.add(i);
      } else {
        const n = parseInt(part, 10);
        if (n >= 1 && n <= max) out.add(n);
      }
    }
    return [...out].sort((a, b) => a - b);
  };

  const handleSplit = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF to split");
    const { file, pageCount } = files[0];
    const pages = parseRange(splitRange, pageCount);
    if (pages.length === 0) return toast.error("Invalid page range");
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p) => p - 1));
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      await saveBlob(blob, `split-${file.name}`, "split", `pages ${splitRange}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Split failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Reorder ─────────────────────────────────────
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const loadReorder = () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setPageOrder(Array.from({ length: files[0].pageCount }, (_, i) => i + 1));
  };
  const movePage = (from: number, to: number) => {
    setPageOrder((p) => {
      const next = [...p];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const handleReorder = async () => {
    if (files.length !== 1 || pageOrder.length === 0) return toast.error("Load pages first");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pageOrder.map((p) => p - 1));
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      await saveBlob(blob, `reordered-${files[0].file.name}`, "reorder", `${pageOrder.length} pages`);
    } catch (e: any) {
      toast.error(e?.message ?? "Reorder failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">PDF Tools</h1>
        <p className="text-muted-foreground mt-1">Merge, split, and reorder pages — all in your browser.</p>
      </div>

      {/* Dropzone */}
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
          <p className="font-medium">{isDragActive ? "Drop here…" : "Drop PDFs or click to browse"}</p>
          <p className="text-xs text-muted-foreground">PDF only. Files stay on your device.</p>
        </div>
      </Card>

      {files.length > 0 && (
        <Card className="p-4 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(f.file.size)} · {f.pageCount} pages
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeFile(i)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Tabs defaultValue="merge" className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="merge">Merge</TabsTrigger>
            <TabsTrigger value="split">Split</TabsTrigger>
            <TabsTrigger value="reorder">Reorder</TabsTrigger>
            <TabsTrigger value="compress">Compress</TabsTrigger>
            <TabsTrigger value="images">To Images</TabsTrigger>
            <TabsTrigger value="watermark">Watermark</TabsTrigger>
            <TabsTrigger value="ocr">OCR</TabsTrigger>
            <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
            <TabsTrigger value="headfoot">Header/Footer</TabsTrigger>
            <TabsTrigger value="redact">Redact</TabsTrigger>
            <TabsTrigger value="sign">Sign</TabsTrigger>
            <TabsTrigger value="thumbs">Thumbnails</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="merge">
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold mb-2">Merge PDFs</h3>
            <p className="text-sm text-muted-foreground mb-4">Combine all dropped PDFs in order, top to bottom.</p>
            <Button onClick={handleMerge} disabled={busy || files.length < 2} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Merge & download
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="split">
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold mb-2">Extract pages</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comma-separated, ranges allowed. Example: <code className="text-foreground">1,3,5-8</code>
            </p>
            <div className="flex gap-3 max-w-md">
              <div className="flex-1 space-y-1">
                <Label htmlFor="range">Pages</Label>
                <Input id="range" value={splitRange} onChange={(e) => setSplitRange(e.target.value)} placeholder="1-3,5" />
              </div>
            </div>
            <Button onClick={handleSplit} disabled={busy || files.length !== 1} className="mt-4 bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DownloadIcon className="h-4 w-4 mr-2" />}
              Extract & download
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="reorder">
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold mb-2">Reorder pages</h3>
            <p className="text-sm text-muted-foreground mb-4">Click ↑/↓ to rearrange, then export.</p>
            <Button variant="outline" onClick={loadReorder} disabled={files.length !== 1}>
              Load pages
            </Button>

            {pageOrder.length > 0 && (
              <div className="mt-4 max-h-96 overflow-auto border border-border rounded-lg p-2 space-y-1">
                {pageOrder.map((p, idx) => (
                  <div key={`${p}-${idx}`} className="flex items-center gap-2 p-2 rounded bg-muted/40">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">Page {p}</Badge>
                    <span className="flex-1 text-sm text-muted-foreground">position {idx + 1}</span>
                    <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => movePage(idx, idx - 1)}>↑</Button>
                    <Button size="sm" variant="ghost" disabled={idx === pageOrder.length - 1} onClick={() => movePage(idx, idx + 1)}>↓</Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleReorder}
              disabled={busy || pageOrder.length === 0}
              className="mt-4 bg-gradient-primary hover:opacity-90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save reordered PDF
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="compress"><CompressPanel files={files} /></TabsContent>
        <TabsContent value="images"><ToImagesPanel files={files} /></TabsContent>
        <TabsContent value="watermark"><WatermarkPanel files={files} /></TabsContent>
        <TabsContent value="ocr"><OcrPanel files={files} /></TabsContent>
        <TabsContent value="encrypt"><EncryptPanel files={files} /></TabsContent>
        <TabsContent value="headfoot"><HeaderFooterPanel files={files} /></TabsContent>
        <TabsContent value="redact"><RedactPanel files={files} /></TabsContent>
        <TabsContent value="sign"><SignPanel files={files} /></TabsContent>
        <TabsContent value="thumbs"><ThumbnailsPanel files={files} /></TabsContent>
        <TabsContent value="edit"><EditPanel files={files} /></TabsContent>
      </Tabs>
    </div>
  );
}
