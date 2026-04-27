import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save } from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";

type Props = { files: { file: File; pageCount: number }[] };

export default function HeaderFooterPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [size, setSize] = useState([10]);
  const [margin, setMargin] = useState([24]);

  const run = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    if (!header.trim() && !footer.trim()) return toast.error("Enter header or footer text");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fs = size[0];
      const m = margin[0];
      const pages = pdf.getPages();

      pages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const replace = (s: string) =>
          s.replace(/\{page\}/gi, String(idx + 1)).replace(/\{total\}/gi, String(pages.length));

        if (header.trim()) {
          const h = replace(header);
          const tw = font.widthOfTextAtSize(h, fs);
          page.drawText(h, {
            x: (width - tw) / 2,
            y: height - m,
            size: fs,
            font,
            color: rgb(0.3, 0.3, 0.3),
          });
        }
        if (footer.trim()) {
          const f = replace(footer);
          const tw = font.widthOfTextAtSize(f, fs);
          page.drawText(f, {
            x: (width - tw) / 2,
            y: m - fs,
            size: fs,
            font,
            color: rgb(0.3, 0.3, 0.3),
          });
        }
      });

      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `headfoot-${files[0].file.name}`;
      downloadBlob(blob, name);
      if (user) await uploadAndRecord(user.id, blob, name, "pdf", "header-footer", `${pages.length} pages`);
      toast.success("Header/Footer applied");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Header & Footer</h3>
        <p className="text-sm text-muted-foreground">
          Use <code className="text-foreground">{"{page}"}</code> and{" "}
          <code className="text-foreground">{"{total}"}</code> for page numbers.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="hf-h">Header text</Label>
          <Input id="hf-h" value={header} onChange={(e) => setHeader(e.target.value)} placeholder="My Document" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hf-f">Footer text</Label>
          <Input id="hf-f" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Page {page} of {total}" />
        </div>
        <div className="space-y-1">
          <Label>Font size: {size[0]}px</Label>
          <Slider value={size} onValueChange={setSize} min={6} max={24} step={1} />
        </div>
        <div className="space-y-1">
          <Label>Margin: {margin[0]}px</Label>
          <Slider value={margin} onValueChange={setMargin} min={12} max={60} step={2} />
        </div>
      </div>
      <Button onClick={run} disabled={busy || files.length !== 1} className="bg-gradient-primary hover:opacity-90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Apply & download
      </Button>
    </Card>
  );
}
