import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas } from "@/lib/pdfRenderer";

type Props = { files: { file: File; pageCount: number }[] };
type Placement = { page: number; x: number; y: number; w: number; h: number }; // normalized

export default function SignPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [sigData, setSigData] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [sigSize, setSigSize] = useState([20]); // % width

  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const totalPages = files[0]?.pageCount ?? 0;

  // Signature pad
  useEffect(() => {
    const c = sigCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
  }, []);

  const sigPos = (e: React.PointerEvent) => {
    const c = sigCanvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const sigDown = (e: React.PointerEvent) => {
    drawing.current = true;
    lastPt.current = sigPos(e);
    sigCanvasRef.current!.setPointerCapture(e.pointerId);
  };
  const sigMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = sigCanvasRef.current!.getContext("2d")!;
    const p = sigPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current!.x, lastPt.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPt.current = p;
  };
  const sigUp = () => {
    drawing.current = false;
    lastPt.current = null;
  };
  const clearSig = () => {
    const c = sigCanvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    setSigData(null);
  };
  const saveSig = () => {
    const c = sigCanvasRef.current!;
    setSigData(c.toDataURL("image/png"));
    toast.success("Signature ready — click on PDF page to place");
  };

  // PDF page rendering
  const loadPage = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setLoaded(true);
    // Wait a tick so wrapRef is mounted
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const pdf = await loadPdfDoc(buf);
      const c = await renderPageToCanvas(pdf, pageNum, 1.5);
      pageCanvasRef.current = c;
      const wrap = wrapRef.current;
      const o = overlayRef.current;
      if (!wrap || !o) return;
      wrap.innerHTML = "";
      c.style.display = "block";
      c.style.maxWidth = "100%";
      wrap.appendChild(c);
      o.width = c.width;
      o.height = c.height;
      o.style.position = "absolute";
      o.style.left = "0";
      o.style.top = "0";
      o.style.cursor = "copy";
      wrap.style.position = "relative";
      wrap.appendChild(o);
      requestAnimationFrame(() => {
        const r = c.getBoundingClientRect();
        o.style.width = `${r.width}px`;
        o.style.height = `${r.height}px`;
        redrawOverlay();
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loaded) loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum]);

  const redrawOverlay = () => {
    const o = overlayRef.current;
    if (!o || !sigData) {
      const ctx = o?.getContext("2d");
      ctx?.clearRect(0, 0, o!.width, o!.height);
      return;
    }
    const ctx = o.getContext("2d")!;
    ctx.clearRect(0, 0, o.width, o.height);
    const img = new Image();
    img.onload = () => {
      placements.filter((p) => p.page === pageNum).forEach((p) => {
        ctx.drawImage(img, p.x * o.width, p.y * o.height, p.w * o.width, p.h * o.height);
      });
    };
    img.src = sigData;
  };

  useEffect(redrawOverlay, [placements, pageNum, sigData]);

  const onPagePointer = (e: React.PointerEvent) => {
    if (!sigData) return toast.error("Draw signature first");
    const o = overlayRef.current!;
    const r = o.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const w = sigSize[0] / 100;
    // Aspect ratio from signature canvas
    const sc = sigCanvasRef.current!;
    const ratio = sc.height / sc.width;
    const h = w * ratio * (o.width / o.height);
    setPlacements((p) => [...p, { page: pageNum, x: x - w / 2, y: y - h / 2, w, h }]);
  };

  const undoLast = () => setPlacements((p) => p.slice(0, -1));

  const apply = async () => {
    if (placements.length === 0) return toast.error("Place signature on at least one page");
    if (!sigData) return;
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pngBytes = await fetch(sigData).then((r) => r.arrayBuffer());
      const png = await pdf.embedPng(pngBytes);
      const pages = pdf.getPages();
      placements.forEach((pl) => {
        const page = pages[pl.page - 1];
        if (!page) return;
        const { width, height } = page.getSize();
        page.drawImage(png, {
          x: pl.x * width,
          y: height - (pl.y + pl.h) * height,
          width: pl.w * width,
          height: pl.h * height,
        });
      });
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `signed-${files[0].file.name}`;
      downloadBlob(blob, name);
      if (user) await uploadAndRecord(user.id, blob, name, "pdf", "sign", `${placements.length} placement(s)`);
      toast.success("Signed PDF saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Sign</h3>
        <p className="text-sm text-muted-foreground">Draw a signature, then click on the page to place it. Visual signature only.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Signature pad */}
        <div className="space-y-2">
          <Label>1. Draw your signature</Label>
          <div className="border border-border rounded-lg bg-white inline-block">
            <canvas
              ref={sigCanvasRef}
              width={400}
              height={150}
              className="touch-none"
              style={{ width: "100%", maxWidth: 400, height: "auto", display: "block" }}
              onPointerDown={sigDown}
              onPointerMove={sigMove}
              onPointerUp={sigUp}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={clearSig}>
              <Trash2 className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button size="sm" onClick={saveSig} className="bg-gradient-primary hover:opacity-90">
              Use signature
            </Button>
          </div>
          {sigData && (
            <div className="space-y-1 pt-2">
              <Label>Size on page: {sigSize[0]}% width</Label>
              <Slider value={sigSize} onValueChange={setSigSize} min={5} max={50} step={1} />
            </div>
          )}
        </div>

        {/* Page preview */}
        <div className="space-y-2">
          <Label>2. Place on PDF page</Label>
          {!loaded ? (
            <div>
              <Button onClick={loadPage} disabled={busy || files.length !== 1} variant="outline">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load PDF
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Page {pageNum} / {totalPages}</span>
                <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))} disabled={pageNum >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={undoLast} disabled={placements.length === 0}>Undo</Button>
              </div>
              <div className="border border-border rounded-lg overflow-auto bg-muted/20 p-2 max-h-[500px]">
                <div ref={wrapRef} style={{ display: "inline-block" }}>
                  <canvas ref={overlayRef} onPointerDown={onPagePointer} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Button onClick={apply} disabled={busy || placements.length === 0} className="bg-gradient-primary hover:opacity-90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Apply & download
      </Button>
    </Card>
  );
}
