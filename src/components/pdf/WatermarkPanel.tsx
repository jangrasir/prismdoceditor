import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";

type Props = { files: { file: File; pageCount: number }[] };

export default function WatermarkPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState([30]);
  const [size, setSize] = useState([60]);
  const [position, setPosition] = useState<"diagonal" | "center" | "header" | "footer">("diagonal");

  const run = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    if (!text.trim()) return toast.error("Enter watermark text");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const op = opacity[0] / 100;
      const fs = size[0];

      pdf.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        const tw = font.widthOfTextAtSize(text, fs);
        let x = (width - tw) / 2;
        let y = height / 2;
        let rot = 0;
        if (position === "diagonal") {
          rot = 45;
          x = width / 2 - tw / 2;
          y = height / 2 - fs / 2;
        } else if (position === "header") {
          y = height - fs - 24;
        } else if (position === "footer") {
          y = 24;
        }
        page.drawText(text, {
          x,
          y,
          size: fs,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: op,
          rotate: degrees(rot),
        });
      });

      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `watermarked-${files[0].file.name}`;
      downloadBlob(blob, name);
      if (user) await uploadAndRecord(user.id, blob, name, "pdf", "watermark", `"${text}" ${position}`);
      toast.success("Watermark applied");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Watermark</h3>
        <p className="text-sm text-muted-foreground">Add text watermark to every page.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="wm-text">Text</Label>
          <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Position</Label>
          <Select value={position} onValueChange={(v) => setPosition(v as typeof position)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diagonal">Diagonal</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="footer">Footer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Opacity: {opacity[0]}%</Label>
          <Slider value={opacity} onValueChange={setOpacity} min={5} max={100} step={5} />
        </div>
        <div className="space-y-1">
          <Label>Font size: {size[0]}px</Label>
          <Slider value={size} onValueChange={setSize} min={12} max={120} step={2} />
        </div>
      </div>
      <Button onClick={run} disabled={busy || files.length !== 1} className="bg-gradient-primary hover:opacity-90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Apply & download
      </Button>
    </Card>
  );
}
