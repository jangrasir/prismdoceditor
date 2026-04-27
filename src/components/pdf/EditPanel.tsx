import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Type, Square, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord } from "@/lib/files";
import { downloadBlob } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas } from "@/lib/pdfRenderer";

type SelectedFile = { file: File; pageCount: number };

type EditItem =
  | { id: string; type: "text"; page: number; xPct: number; yPct: number; text: string; size: number; color: string }
  | { id: string; type: "rect"; page: number; xPct: number; yPct: number; wPct: number; hPct: number; color: string }
  | { id: string; type: "image"; page: number; xPct: number; yPct: number; wPct: number; dataUrl: string };

const hexToRgb = (hex: string) => {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
};

export default function EditPanel({ files }: { files: SelectedFile[] }) {
  const { user } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [items, setItems] = useState<EditItem[]>([]);
  const [tool, setTool] = useState<"text" | "rect" | "image">("text");
  const [text, setText] = useState("Sample text");
  const [size, setSize] = useState(18);
  const [color, setColor] = useState("#ff0000");
  const [rectW, setRectW] = useState(20);
  const [rectH, setRectH] = useState(10);
  const [imgDataUrl, setImgDataUrl] = useState<string>("");
  const [imgW, setImgW] = useState(25);
  const [pageDims, setPageDims] = useState({ w: 0, h: 0 });

  const loadPage = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setLoaded(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const pdf = await loadPdfDoc(files[0].file);
      const target = Math.min(Math.max(1, pageNum), pdf.numPages);
      const canvas = await renderPageToCanvas(pdf, target, 1.5);
      const wrap = wrapRef.current;
      if (!wrap) return;
      wrap.innerHTML = "";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.display = "block";
      wrap.appendChild(canvas);
      setPageDims({ w: canvas.width, h: canvas.height });
    } catch (e: any) {
      toast.error(e?.message ?? "Load failed");
    }
  };

  useEffect(() => {
    if (loaded) loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum]);

  const onClickPage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!loaded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const id = Math.random().toString(36).slice(2);
    if (tool === "text") {
      if (!text.trim()) return toast.error("Enter text first");
      setItems((p) => [...p, { id, type: "text", page: pageNum, xPct, yPct, text, size, color }]);
    } else if (tool === "rect") {
      setItems((p) => [...p, { id, type: "rect", page: pageNum, xPct, yPct, wPct: rectW, hPct: rectH, color }]);
    } else if (tool === "image") {
      if (!imgDataUrl) return toast.error("Pick an image first");
      setItems((p) => [...p, { id, type: "image", page: pageNum, xPct, yPct, wPct: imgW, dataUrl: imgDataUrl }]);
    }
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImgDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const removeItem = (id: string) => setItems((p) => p.filter((i) => i.id !== id));
  const clearPage = () => setItems((p) => p.filter((i) => i.page !== pageNum));

  const exportPdf = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    if (items.length === 0) return toast.error("Add some edits first");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();

      // Pre-embed images
      const imgCache = new Map<string, any>();
      for (const it of items) {
        if (it.type === "image" && !imgCache.has(it.dataUrl)) {
          const isPng = it.dataUrl.startsWith("data:image/png");
          const b64 = it.dataUrl.split(",")[1];
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const embed = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          imgCache.set(it.dataUrl, embed);
        }
      }

      for (const it of items) {
        const page = pages[it.page - 1];
        if (!page) continue;
        const { width: pw, height: ph } = page.getSize();
        const x = (it.xPct / 100) * pw;
        const yFromTop = (it.yPct / 100) * ph;

        if (it.type === "text") {
          page.drawText(it.text, {
            x,
            y: ph - yFromTop - it.size,
            size: it.size,
            font,
            color: hexToRgb(it.color),
          });
        } else if (it.type === "rect") {
          const w = (it.wPct / 100) * pw;
          const h = (it.hPct / 100) * ph;
          page.drawRectangle({
            x,
            y: ph - yFromTop - h,
            width: w,
            height: h,
            color: hexToRgb(it.color),
          });
        } else if (it.type === "image") {
          const embed = imgCache.get(it.dataUrl);
          const w = (it.wPct / 100) * pw;
          const h = (w / embed.width) * embed.height;
          page.drawImage(embed, {
            x,
            y: ph - yFromTop - h,
            width: w,
            height: h,
          });
        }
      }

      const bytes = await doc.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `edited-${files[0].file.name}`;
      downloadBlob(blob, name);
      if (user) {
        try {
          await uploadAndRecord(user.id, blob, name, "pdf", "edit", `${items.length} edits`);
          toast.success("Saved to library");
        } catch {}
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const pageItems = items.filter((i) => i.page === pageNum);

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Edit PDF manually</h3>
        <p className="text-sm text-muted-foreground">
          Add text, shapes, or images by clicking on the page. Edits are baked into the exported PDF.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="page">Page</Label>
          <Input
            id="page"
            type="number"
            min={1}
            max={files[0]?.pageCount ?? 1}
            value={pageNum}
            onChange={(e) => setPageNum(parseInt(e.target.value) || 1)}
            className="w-24"
          />
        </div>
        <Button variant="outline" onClick={loadPage} disabled={files.length !== 1}>
          Load page
        </Button>
        <Button onClick={exportPdf} disabled={busy || items.length === 0} className="bg-gradient-primary hover:opacity-90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Export edited PDF
        </Button>
      </div>

      {/* Tool palette */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" variant={tool === "text" ? "default" : "outline"} onClick={() => setTool("text")}>
          <Type className="h-3 w-3 mr-1" /> Text
        </Button>
        <Button size="sm" variant={tool === "rect" ? "default" : "outline"} onClick={() => setTool("rect")}>
          <Square className="h-3 w-3 mr-1" /> Rect
        </Button>
        <Button size="sm" variant={tool === "image" ? "default" : "outline"} onClick={() => setTool("image")}>
          <ImageIcon className="h-3 w-3 mr-1" /> Image
        </Button>
      </div>

      {/* Tool options */}
      <div className="flex flex-wrap gap-3 items-end">
        {tool === "text" && (
          <>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label>Text</Label>
              <Input value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Size</Label>
              <Input type="number" min={6} max={200} value={size} onChange={(e) => setSize(parseInt(e.target.value) || 18)} className="w-20" />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 h-10 p-1" />
            </div>
          </>
        )}
        {tool === "rect" && (
          <>
            <div className="space-y-1">
              <Label>Width %</Label>
              <Input type="number" min={1} max={100} value={rectW} onChange={(e) => setRectW(parseFloat(e.target.value) || 20)} className="w-24" />
            </div>
            <div className="space-y-1">
              <Label>Height %</Label>
              <Input type="number" min={1} max={100} value={rectH} onChange={(e) => setRectH(parseFloat(e.target.value) || 10)} className="w-24" />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 h-10 p-1" />
            </div>
          </>
        )}
        {tool === "image" && (
          <>
            <div className="space-y-1">
              <Label>Pick image</Label>
              <Input type="file" accept="image/png,image/jpeg" onChange={onPickImage} />
            </div>
            <div className="space-y-1">
              <Label>Width %</Label>
              <Input type="number" min={1} max={100} value={imgW} onChange={(e) => setImgW(parseFloat(e.target.value) || 25)} className="w-24" />
            </div>
            {imgDataUrl && <Badge variant="secondary">Image ready</Badge>}
          </>
        )}
      </div>

      {/* Page canvas */}
      {loaded && (
        <div className="relative border border-border rounded-lg overflow-hidden bg-muted/20">
          <div
            ref={wrapRef}
            className="relative cursor-crosshair"
            onClick={onClickPage}
            style={{ aspectRatio: pageDims.w && pageDims.h ? `${pageDims.w} / ${pageDims.h}` : undefined }}
          />
          {/* Overlay markers */}
          <div className="absolute inset-0 pointer-events-none">
            {pageItems.map((it) => {
              const style: React.CSSProperties = {
                position: "absolute",
                left: `${it.xPct}%`,
                top: `${it.yPct}%`,
              };
              if (it.type === "text") {
                return (
                  <div key={it.id} style={{ ...style, color: it.color, fontSize: `${it.size * 0.6}px`, lineHeight: 1 }}>
                    {it.text}
                  </div>
                );
              }
              if (it.type === "rect") {
                return (
                  <div
                    key={it.id}
                    style={{
                      ...style,
                      width: `${it.wPct}%`,
                      height: `${it.hPct}%`,
                      background: it.color,
                      opacity: 0.85,
                    }}
                  />
                );
              }
              return (
                <img
                  key={it.id}
                  src={it.dataUrl}
                  alt=""
                  style={{ ...style, width: `${it.wPct}%`, height: "auto" }}
                />
              );
            })}
          </div>
        </div>
      )}

      {pageItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Edits on page {pageNum}</p>
            <Button size="sm" variant="ghost" onClick={clearPage}>
              <Trash2 className="h-3 w-3 mr-1" /> Clear page
            </Button>
          </div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {pageItems.map((it) => (
              <div key={it.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/40">
                <Badge variant="secondary">{it.type}</Badge>
                <span className="flex-1 truncate text-muted-foreground">
                  {it.type === "text" ? it.text : `at ${it.xPct.toFixed(0)}%, ${it.yPct.toFixed(0)}%`}
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeItem(it.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
