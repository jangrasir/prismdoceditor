import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Image as ImageIcon, X, Loader2, RotateCw, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob, formatBytes } from "@/lib/files";

export default function ImageTools() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // settings
  const [quality, setQuality] = useState(70);
  const [width, setWidth] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [rotation, setRotation] = useState(0);
  const [convertTo, setConvertTo] = useState<"image/jpeg" | "image/png">("image/png");
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const onDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f || !f.type.startsWith("image/")) return toast.error("Image files only");
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setRotation(0);
  }, [previewUrl]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] },
    maxFiles: 1,
  });

  // Process: applies rotation + resize, outputs to chosen mime
  const processCanvas = async (mime: string, q = 0.92): Promise<Blob> => {
    if (!file || !imgRef.current) throw new Error("No image");
    const img = imgRef.current;
    const w = typeof width === "number" && width > 0 ? width : naturalSize.w;
    const h = typeof height === "number" && height > 0 ? height : naturalSize.h;

    const rad = (rotation * Math.PI) / 180;
    const swap = rotation % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Canvas failed")), mime, q);
    });
  };

  const saveBlob = async (blob: Blob, name: string, action: string, details?: string) => {
    downloadBlob(blob, name);
    if (user) {
      try {
        await uploadAndRecord(user.id, blob, name, blob.type.includes("pdf") ? "pdf" : "image", action, details);
        toast.success("Saved to library");
      } catch (e: any) {
        toast.error("Saved locally — library save failed: " + (e?.message ?? "error"));
      }
    }
  };

  const baseName = (file?.name ?? "image").replace(/\.[^.]+$/, "");

  // ── Compress ────────────────────────────────────
  const handleCompress = async () => {
    if (!file) return toast.error("Drop an image first");
    setBusy(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 10,
        useWebWorker: true,
        initialQuality: quality / 100,
      });
      const ext = file.type.includes("png") ? "png" : "jpg";
      await saveBlob(compressed, `${baseName}-compressed.${ext}`, "compress", `quality ${quality}%`);
    } catch (e: any) {
      toast.error(e?.message ?? "Compress failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Resize ──────────────────────────────────────
  const handleResize = async () => {
    if (!file) return toast.error("Drop an image first");
    setBusy(true);
    try {
      const blob = await processCanvas(file.type, 0.95);
      await saveBlob(blob, `${baseName}-resized.${file.type === "image/png" ? "png" : "jpg"}`, "resize", `${width || naturalSize.w}×${height || naturalSize.h}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Resize failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Rotate (just save current rotation) ─────────
  const handleRotateSave = async () => {
    if (!file) return toast.error("Drop an image first");
    setBusy(true);
    try {
      const blob = await processCanvas(file.type, 0.95);
      await saveBlob(blob, `${baseName}-rotated.${file.type === "image/png" ? "png" : "jpg"}`, "rotate", `${rotation}°`);
    } catch (e: any) {
      toast.error(e?.message ?? "Rotate failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Convert format ──────────────────────────────
  const handleConvert = async () => {
    if (!file) return toast.error("Drop an image first");
    setBusy(true);
    try {
      const blob = await processCanvas(convertTo, 0.95);
      const ext = convertTo === "image/jpeg" ? "jpg" : "png";
      await saveBlob(blob, `${baseName}.${ext}`, "convert", `${file.type} → ${convertTo}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Convert failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Image → PDF ─────────────────────────────────
  const handleToPdf = async () => {
    if (!file) return toast.error("Drop an image first");
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.create();
      const img = file.type.includes("png")
        ? await pdf.embedPng(buf)
        : await pdf.embedJpg(buf);
      const page = pdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      await saveBlob(blob, `${baseName}.pdf`, "convert", "image → pdf");
    } catch (e: any) {
      toast.error(e?.message ?? "Conversion failed (use JPG or PNG)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Image Tools</h1>
        <p className="text-muted-foreground mt-1">Resize, rotate, compress, and convert your images.</p>
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
          <p className="font-medium">{isDragActive ? "Drop here…" : "Drop image or click to browse"}</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP, GIF</p>
        </div>
      </Card>

      {file && previewUrl && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <ImageIcon className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {file.type}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setFile(null); setPreviewUrl(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-center bg-muted/30 rounded-lg p-4 overflow-hidden">
            <img
              ref={imgRef}
              src={previewUrl}
              alt="preview"
              style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.3s" }}
              className="max-h-80 object-contain"
              onLoad={(e) => {
                const im = e.currentTarget;
                setNaturalSize({ w: im.naturalWidth, h: im.naturalHeight });
                setWidth(im.naturalWidth);
                setHeight(im.naturalHeight);
              }}
            />
          </div>
        </Card>
      )}

      <Tabs defaultValue="compress" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
          <TabsTrigger value="compress">Compress</TabsTrigger>
          <TabsTrigger value="resize">Resize</TabsTrigger>
          <TabsTrigger value="rotate">Rotate</TabsTrigger>
          <TabsTrigger value="convert">Convert</TabsTrigger>
          <TabsTrigger value="topdf">→ PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="compress">
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Compress image</h3>
            <div className="space-y-2 max-w-md">
              <div className="flex justify-between text-sm">
                <Label>Quality</Label>
                <span className="text-muted-foreground">{quality}%</span>
              </div>
              <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={10} max={100} step={5} />
            </div>
            <Button onClick={handleCompress} disabled={busy || !file} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Compress & save
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="resize">
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Resize</h3>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1">
                <Label>Width (px)</Label>
                <Input type="number" value={width} onChange={(e) => setWidth(e.target.value ? parseInt(e.target.value) : "")} />
              </div>
              <div className="space-y-1">
                <Label>Height (px)</Label>
                <Input type="number" value={height} onChange={(e) => setHeight(e.target.value ? parseInt(e.target.value) : "")} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Original: {naturalSize.w}×{naturalSize.h}</p>
            <Button onClick={handleResize} disabled={busy || !file} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Resize & save
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="rotate">
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Rotate</h3>
            <div className="flex gap-2 flex-wrap">
              {[0, 90, 180, 270].map((d) => (
                <Button key={d} variant={rotation === d ? "default" : "outline"} onClick={() => setRotation(d)}>
                  {d}°
                </Button>
              ))}
              <Button variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateCw className="h-4 w-4 mr-2" />
                +90°
              </Button>
            </div>
            <Button onClick={handleRotateSave} disabled={busy || !file} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save rotated
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="convert">
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Convert format</h3>
            <div className="flex gap-2">
              <Button variant={convertTo === "image/png" ? "default" : "outline"} onClick={() => setConvertTo("image/png")}>PNG</Button>
              <Button variant={convertTo === "image/jpeg" ? "default" : "outline"} onClick={() => setConvertTo("image/jpeg")}>JPG</Button>
            </div>
            <Button onClick={handleConvert} disabled={busy || !file} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Convert & save
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="topdf">
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Image → PDF</h3>
            <p className="text-sm text-muted-foreground">Wraps your image in a single-page PDF (PNG or JPG only).</p>
            <Button onClick={handleToPdf} disabled={busy || !file} className="bg-gradient-primary hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Convert to PDF
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
