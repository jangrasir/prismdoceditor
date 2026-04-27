import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { PDFDocument, rgb } from "pdf-lib";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas } from "@/lib/pdfRenderer";

type Props = { files: { file: File; pageCount: number }[] };
type Box = { x: number; y: number; w: number; h: number }; // normalized 0..1
type Rects = Record<number, Box[]>; // page index → boxes

export default function RedactPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [rects, setRects] = useState<Rects>({});
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number } | null>(null);

  const totalPages = files[0]?.pageCount ?? 0;

  const loadPage = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const pdf = await loadPdfDoc(buf);
      const c = await renderPageToCanvas(pdf, pageNum, 1.5);
      canvasRef.current = c;
      const wrap = wrapRef.current!;
      wrap.innerHTML = "";
      c.style.display = "block";
      c.style.maxWidth = "100%";
      wrap.appendChild(c);
      const o = overlayRef.current!;
      o.width = c.width;
      o.height = c.height;
      o.style.position = "absolute";
      o.style.left = "0";
      o.style.top = "0";
      o.style.width = c.style.width || `${c.width}px`;
      o.style.height = c.style.height || `${c.height}px`;
      o.style.cursor = "crosshair";
      wrap.style.position = "relative";
      wrap.appendChild(o);
      // Sync overlay size to displayed canvas size
      requestAnimationFrame(() => {
        const rect = c.getBoundingClientRect();
        o.style.width = `${rect.width}px`;
        o.style.height = `${rect.height}px`;
        redraw();
      });
      setLoaded(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to render");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loaded) loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum]);

  const redraw = () => {
    const o = overlayRef.current;
    if (!o) return;
    const ctx = o.getContext("2d")!;
    ctx.clearRect(0, 0, o.width, o.height);
    const boxes = rects[pageNum] ?? [];
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    boxes.forEach((b) => {
      ctx.fillRect(b.x * o.width, b.y * o.height, b.w * o.width, b.h * o.height);
    });
  };

  useEffect(redraw, [rects, pageNum]);

  const getPos = (e: React.PointerEvent) => {
    const o = overlayRef.current!;
    const rect = o.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    drawing.current = getPos(e);
    overlayRef.current!.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const o = overlayRef.current!;
    const ctx = o.getContext("2d")!;
    redraw();
    const cur = getPos(e);
    const x = Math.min(drawing.current.x, cur.x) * o.width;
    const y = Math.min(drawing.current.y, cur.y) * o.height;
    const w = Math.abs(cur.x - drawing.current.x) * o.width;
    const h = Math.abs(cur.y - drawing.current.y) * o.height;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(x, y, w, h);
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const cur = getPos(e);
    const start = drawing.current;
    drawing.current = null;
    const box: Box = {
      x: Math.min(start.x, cur.x),
      y: Math.min(start.y, cur.y),
      w: Math.abs(cur.x - start.x),
      h: Math.abs(cur.y - start.y),
    };
    if (box.w < 0.005 || box.h < 0.005) return;
    setRects((p) => ({ ...p, [pageNum]: [...(p[pageNum] ?? []), box] }));
  };

  const clearPage = () => setRects((p) => ({ ...p, [pageNum]: [] }));
  const clearAll = () => setRects({});

  const apply = async () => {
    if (files.length !== 1) return;
    const total = Object.values(rects).reduce((a, b) => a + b.length, 0);
    if (total === 0) return toast.error("Draw at least one box");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      pdf.getPages().forEach((page, idx) => {
        const boxes = rects[idx + 1] ?? [];
        const { width, height } = page.getSize();
        boxes.forEach((b) => {
          // PDF coords: origin bottom-left
          page.drawRectangle({
            x: b.x * width,
            y: height - (b.y + b.h) * height,
            width: b.w * width,
            height: b.h * height,
            color: rgb(0, 0, 0),
            opacity: 1,
          });
        });
      });
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `redacted-${files[0].file.name}`;
      downloadBlob(blob, name);
      if (user) await uploadAndRecord(user.id, blob, name, "pdf", "redact", `${total} boxes`);
      toast.success("Redacted PDF saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Redact</h3>
        <p className="text-sm text-muted-foreground">Drag to draw black boxes over sensitive content. Boxes are baked into the PDF.</p>
      </div>

      {!loaded ? (
        <Button onClick={loadPage} disabled={busy || files.length !== 1} variant="outline">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Load PDF
        </Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {pageNum} / {totalPages}</span>
            <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))} disabled={pageNum >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={clearPage}>
              <Trash2 className="h-4 w-4 mr-1" /> Clear page
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>Clear all</Button>
          </div>

          <div className="border border-border rounded-lg overflow-auto bg-muted/20 p-2 max-h-[600px]">
            <div ref={wrapRef} style={{ display: "inline-block" }}>
              <canvas
                ref={overlayRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
              />
            </div>
          </div>

          <Button onClick={apply} disabled={busy} className="bg-gradient-primary hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Apply & download
          </Button>
        </>
      )}
    </Card>
  );
}
