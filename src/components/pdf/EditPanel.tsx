import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Type, Square, Image as ImageIcon, Trash2, Undo2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas } from "@/lib/pdfRenderer";

type SelectedFile = { file: File; pageCount: number };

type BaseItem = { id: string; page: number; xPct: number; yPct: number };
type TextItem = BaseItem & { type: "text"; text: string; size: number; color: string };
type RectItem = BaseItem & { type: "rect"; wPct: number; hPct: number; color: string };
type ImageItem = BaseItem & { type: "image"; wPct: number; hPct: number; dataUrl: string; natW: number; natH: number };
type EditItem = TextItem | RectItem | ImageItem;

const hexToRgb = (hex: string) => {
  const m = hex.replace("#", "");
  return rgb(
    parseInt(m.slice(0, 2), 16) / 255,
    parseInt(m.slice(2, 4), 16) / 255,
    parseInt(m.slice(4, 6), 16) / 255
  );
};

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; id: string; startX: number; startY: number; origW: number; origH: number; origSize?: number }
  | null;

export default function EditPanel({ files }: { files: SelectedFile[] }) {
  const { user } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<EditItem[][]>([]);

  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [items, setItems] = useState<EditItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [tool, setTool] = useState<"select" | "text" | "rect" | "image">("select");
  const [text, setText] = useState("Sample text");
  const [size, setSize] = useState(18);
  const [color, setColor] = useState("#ff0000");
  const [rectW, setRectW] = useState(20);
  const [rectH, setRectH] = useState(10);
  const [imgDataUrl, setImgDataUrl] = useState<string>("");
  const [imgNat, setImgNat] = useState({ w: 1, h: 1 });
  const [imgW, setImgW] = useState(25);
  const [pageDims, setPageDims] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<DragState>(null);

  const pushHistory = (next: EditItem[]) => {
    historyRef.current.push(items);
    if (historyRef.current.length > 50) historyRef.current.shift();
    setItems(next);
  };
  const undo = () => {
    const prev = historyRef.current.pop();
    if (prev) setItems(prev);
    else toast("Nothing to undo");
  };

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
    if (!loaded || tool === "select" || drag) return;
    if ((e.target as HTMLElement).dataset.handle) return;
    if ((e.target as HTMLElement).dataset.itemId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const id = Math.random().toString(36).slice(2);
    if (tool === "text") {
      if (!text.trim()) return toast.error("Enter text first");
      pushHistory([...items, { id, type: "text", page: pageNum, xPct, yPct, text, size, color }]);
    } else if (tool === "rect") {
      pushHistory([...items, { id, type: "rect", page: pageNum, xPct, yPct, wPct: rectW, hPct: rectH, color }]);
    } else if (tool === "image") {
      if (!imgDataUrl) return toast.error("Pick an image first");
      const aspect = imgNat.h / imgNat.w;
      const wPct = imgW;
      const hPct = (wPct * (pageDims.w / pageDims.h)) * aspect;
      pushHistory([...items, { id, type: "image", page: pageNum, xPct, yPct, wPct, hPct, dataUrl: imgDataUrl, natW: imgNat.w, natH: imgNat.h }]);
    }
    setSelectedId(id);
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const im = new Image();
      im.onload = () => {
        setImgNat({ w: im.naturalWidth, h: im.naturalHeight });
        setImgDataUrl(url);
      };
      im.src = url;
    };
    reader.readAsDataURL(f);
  };

  const removeItem = (id: string) => {
    pushHistory(items.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const updateItem = (id: string, patch: Partial<EditItem>) => {
    setItems((p) => p.map((i) => (i.id === id ? ({ ...i, ...patch } as EditItem) : i)));
  };
  const clearPage = () => pushHistory(items.filter((i) => i.page !== pageNum));

  // ── Drag / resize ────────────────────────────────
  const startMove = (e: React.PointerEvent, it: EditItem) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedId(it.id);
    setDrag({ kind: "move", id: it.id, startX: e.clientX, startY: e.clientY, origX: it.xPct, origY: it.yPct });
  };
  const startResize = (e: React.PointerEvent, it: EditItem) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedId(it.id);
    if (it.type === "text") {
      setDrag({ kind: "resize", id: it.id, startX: e.clientX, startY: e.clientY, origW: 0, origH: 0, origSize: it.size });
    } else {
      setDrag({ kind: "resize", id: it.id, startX: e.clientX, startY: e.clientY, origW: it.wPct, origH: it.hPct });
    }
  };

  useEffect(() => {
    if (!drag) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const onMove = (e: PointerEvent) => {
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
      setItems((p) =>
        p.map((i) => {
          if (i.id !== drag.id) return i;
          if (drag.kind === "move") {
            return { ...i, xPct: Math.max(0, Math.min(100, drag.origX + dxPct)), yPct: Math.max(0, Math.min(100, drag.origY + dyPct)) };
          }
          if (i.type === "text") {
            const newSize = Math.max(6, Math.min(400, (drag.origSize ?? 18) + (e.clientY - drag.startY) * 0.5));
            return { ...i, size: Math.round(newSize) };
          }
          if (i.type === "image") {
            const newW = Math.max(2, Math.min(100, drag.origW + dxPct));
            const aspect = i.natH / i.natW;
            const newH = (newW * (pageDims.w / pageDims.h)) * aspect;
            return { ...i, wPct: newW, hPct: newH };
          }
          return { ...i, wPct: Math.max(1, Math.min(100, drag.origW + dxPct)), hPct: Math.max(1, Math.min(100, drag.origH + dyPct)) };
        })
      );
    };
    const onUp = () => {
      historyRef.current.push(items);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, pageDims]);

  const exportPdf = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    if (items.length === 0) return toast.error("Add some edits first");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();

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
          page.drawText(it.text, { x, y: ph - yFromTop - it.size, size: it.size, font, color: hexToRgb(it.color) });
        } else if (it.type === "rect") {
          const w = (it.wPct / 100) * pw;
          const h = (it.hPct / 100) * ph;
          page.drawRectangle({ x, y: ph - yFromTop - h, width: w, height: h, color: hexToRgb(it.color) });
        } else {
          const embed = imgCache.get(it.dataUrl);
          const w = (it.wPct / 100) * pw;
          const h = (it.hPct / 100) * ph;
          page.drawImage(embed, { x, y: ph - yFromTop - h, width: w, height: h });
        }
      }

      const bytes = await doc.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `edited-${files[0].file.name}`;
      downloadBlob(blob, name);
      if (user) {
        try {
          await uploadAndRecord(user.id, blob, name, "pdf", "edit", `${items.length} edits across ${new Set(items.map((i) => i.page)).size} pages`);
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
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const maxPage = files[0]?.pageCount ?? 1;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Edit PDF manually</h3>
        <p className="text-sm text-muted-foreground">
          Click to add text, rectangles, or images. Drag to move, drag the bottom-right handle to resize. Edits persist across pages and export as one PDF.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="page">Page</Label>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              id="page"
              type="number"
              min={1}
              max={maxPage}
              value={pageNum}
              onChange={(e) => setPageNum(Math.max(1, Math.min(maxPage, parseInt(e.target.value) || 1)))}
              className="w-20 text-center"
            />
            <Button size="icon" variant="outline" onClick={() => setPageNum((p) => Math.min(maxPage, p + 1))} disabled={pageNum >= maxPage}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground ml-1">/ {maxPage}</span>
          </div>
        </div>
        <Button variant="outline" onClick={loadPage} disabled={files.length !== 1}>
          {loaded ? "Reload page" : "Load page"}
        </Button>
        <Button variant="outline" onClick={undo} disabled={historyRef.current.length === 0}>
          <Undo2 className="h-4 w-4 mr-1" /> Undo
        </Button>
        <Button onClick={exportPdf} disabled={busy || items.length === 0} className="bg-gradient-primary hover:opacity-90 ml-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Export ({items.length} edit{items.length !== 1 ? "s" : ""}, {new Set(items.map((i) => i.page)).size} page{new Set(items.map((i) => i.page)).size !== 1 ? "s" : ""})
        </Button>
      </div>

      {/* Tool palette */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")}>
          Select
        </Button>
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
      {tool !== "select" && (
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
      )}

      {/* Page canvas + live preview overlay */}
      {loaded && (
        <div
          className={`relative border border-border rounded-lg overflow-hidden bg-muted/20 ${
            tool === "select" ? "cursor-default" : "cursor-crosshair"
          }`}
          onClick={onClickPage}
          style={{ aspectRatio: pageDims.w && pageDims.h ? `${pageDims.w} / ${pageDims.h}` : undefined }}
        >
          <div ref={wrapRef} className="absolute inset-0" />
          <div ref={overlayRef} className="absolute inset-0">
            {pageItems.map((it) => {
              const isSel = it.id === selectedId;
              const baseStyle: React.CSSProperties = {
                position: "absolute",
                left: `${it.xPct}%`,
                top: `${it.yPct}%`,
                cursor: "move",
                outline: isSel ? "2px solid hsl(var(--primary))" : "1px dashed hsl(var(--border))",
                outlineOffset: 1,
              };
              const handle = (
                <div
                  data-handle="resize"
                  onPointerDown={(e) => startResize(e, it)}
                  className="absolute -right-1.5 -bottom-1.5 h-3 w-3 bg-primary rounded-sm cursor-nwse-resize"
                  style={{ display: isSel ? "block" : "none" }}
                />
              );
              if (it.type === "text") {
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    onPointerDown={(e) => startMove(e, it)}
                    style={{
                      ...baseStyle,
                      color: it.color,
                      fontSize: `${(it.size / pageDims.h) * 100 * (pageDims.h / 100) * 0.6}px`,
                      lineHeight: 1,
                      padding: 2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.text}
                    {handle}
                  </div>
                );
              }
              if (it.type === "rect") {
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    onPointerDown={(e) => startMove(e, it)}
                    style={{ ...baseStyle, width: `${it.wPct}%`, height: `${it.hPct}%`, background: it.color, opacity: 0.85 }}
                  >
                    {handle}
                  </div>
                );
              }
              return (
                <div
                  key={it.id}
                  data-item-id={it.id}
                  onPointerDown={(e) => startMove(e, it)}
                  style={{ ...baseStyle, width: `${it.wPct}%`, height: `${it.hPct}%` }}
                >
                  <img src={it.dataUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />
                  {handle}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected item editor */}
      {selected && (
        <Card className="p-4 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Edit selected {selected.type}</p>
            <Button size="sm" variant="ghost" onClick={() => removeItem(selected.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {selected.type === "text" && (
              <>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label>Text</Label>
                  <Input value={selected.text} onChange={(e) => updateItem(selected.id, { text: e.target.value } as any)} />
                </div>
                <div className="space-y-1">
                  <Label>Size</Label>
                  <Input type="number" min={6} max={400} value={selected.size} onChange={(e) => updateItem(selected.id, { size: parseInt(e.target.value) || 18 } as any)} className="w-20" />
                </div>
                <div className="space-y-1">
                  <Label>Color</Label>
                  <Input type="color" value={selected.color} onChange={(e) => updateItem(selected.id, { color: e.target.value } as any)} className="w-16 h-10 p-1" />
                </div>
              </>
            )}
            {selected.type === "rect" && (
              <>
                <div className="space-y-1">
                  <Label>Width %</Label>
                  <Input type="number" min={1} max={100} value={selected.wPct.toFixed(1)} onChange={(e) => updateItem(selected.id, { wPct: parseFloat(e.target.value) || 1 } as any)} className="w-24" />
                </div>
                <div className="space-y-1">
                  <Label>Height %</Label>
                  <Input type="number" min={1} max={100} value={selected.hPct.toFixed(1)} onChange={(e) => updateItem(selected.id, { hPct: parseFloat(e.target.value) || 1 } as any)} className="w-24" />
                </div>
                <div className="space-y-1">
                  <Label>Color</Label>
                  <Input type="color" value={selected.color} onChange={(e) => updateItem(selected.id, { color: e.target.value } as any)} className="w-16 h-10 p-1" />
                </div>
              </>
            )}
            {selected.type === "image" && (
              <>
                <div className="space-y-1">
                  <Label>Width %</Label>
                  <Input type="number" min={1} max={100} value={selected.wPct.toFixed(1)} onChange={(e) => {
                    const newW = parseFloat(e.target.value) || 1;
                    const aspect = selected.natH / selected.natW;
                    const newH = (newW * (pageDims.w / pageDims.h)) * aspect;
                    updateItem(selected.id, { wPct: newW, hPct: newH } as any);
                  }} className="w-24" />
                </div>
                <div className="space-y-1">
                  <Label>Height %</Label>
                  <Input type="number" min={1} max={100} value={selected.hPct.toFixed(1)} onChange={(e) => updateItem(selected.id, { hPct: parseFloat(e.target.value) || 1 } as any)} className="w-24" />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>X %</Label>
              <Input type="number" min={0} max={100} value={selected.xPct.toFixed(1)} onChange={(e) => updateItem(selected.id, { xPct: parseFloat(e.target.value) || 0 } as any)} className="w-20" />
            </div>
            <div className="space-y-1">
              <Label>Y %</Label>
              <Input type="number" min={0} max={100} value={selected.yPct.toFixed(1)} onChange={(e) => updateItem(selected.id, { yPct: parseFloat(e.target.value) || 0 } as any)} className="w-20" />
            </div>
          </div>
        </Card>
      )}

      {/* Edit list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">All edits ({items.length})</p>
            <Button size="sm" variant="ghost" onClick={clearPage} disabled={pageItems.length === 0}>
              <Trash2 className="h-3 w-3 mr-1" /> Clear page {pageNum}
            </Button>
          </div>
          <div className="space-y-1 max-h-56 overflow-auto">
            {items.map((it) => {
              const isSel = it.id === selectedId;
              return (
                <button
                  key={it.id}
                  onClick={() => {
                    setSelectedId(it.id);
                    if (it.page !== pageNum) setPageNum(it.page);
                    setTool("select");
                  }}
                  className={`w-full flex items-center gap-2 text-xs p-2 rounded text-left transition-colors ${
                    isSel ? "bg-primary/10 ring-1 ring-primary" : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  <Badge variant="secondary">{it.type}</Badge>
                  <Badge variant="outline">p{it.page}</Badge>
                  <span className="flex-1 truncate text-muted-foreground">
                    {it.type === "text" ? it.text : `at ${it.xPct.toFixed(0)}%, ${it.yPct.toFixed(0)}%`}
                  </span>
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(it.id);
                    }}
                    className="p-1 rounded hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
