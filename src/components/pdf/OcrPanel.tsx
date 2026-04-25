import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ScanText, Download as DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";
import { loadPdfDoc, renderPageToCanvas, canvasToBlob } from "@/lib/pdfRenderer";

type Props = { files: { file: File; pageCount: number }[] };

const LANGS = [
  { value: "eng", label: "English" },
  { value: "hin", label: "Hindi" },
  { value: "spa", label: "Spanish" },
  { value: "fra", label: "French" },
  { value: "deu", label: "German" },
];

export default function OcrPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState("eng");
  const [progress, setProgress] = useState(0);
  const [pageStatus, setPageStatus] = useState("");
  const [result, setResult] = useState("");

  const run = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    setBusy(true);
    setProgress(0);
    setResult("");
    try {
      const { getOcrWorker } = await import("@/lib/ocrWorker");
      const worker = await getOcrWorker(lang);
      const pdf = await loadPdfDoc(files[0].file);
      const all: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        setPageStatus(`Page ${i}/${pdf.numPages}`);
        const canvas = await renderPageToCanvas(pdf, i, 2);
        const blob = await canvasToBlob(canvas, "image/png");
        const { data } = await worker.recognize(blob);
        all.push(`--- Page ${i} ---\n${data.text.trim()}`);
        setProgress(Math.round((i / pdf.numPages) * 100));
      }

      const text = all.join("\n\n");
      setResult(text);
      const txtBlob = new Blob([text], { type: "text/plain" });
      const name = `${files[0].file.name.replace(/\.pdf$/i, "")}-ocr.txt`;
      downloadBlob(txtBlob, name);
      if (user) await uploadAndRecord(user.id, txtBlob, name, "text", "ocr", `${lang} · ${pdf.numPages}p`);
      toast.success("OCR complete");
    } catch (e: any) {
      toast.error(e?.message ?? "OCR failed");
    } finally {
      setBusy(false);
      setPageStatus("");
    }
  };

  const downloadAgain = () => {
    if (!result) return;
    const name = files[0]?.file.name.replace(/\.pdf$/i, "") || "ocr";
    downloadBlob(new Blob([result], { type: "text/plain" }), `${name}-ocr.txt`);
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">OCR — extract text</h3>
        <p className="text-sm text-muted-foreground">
          Reads text from scanned/image PDFs. First run downloads ~10MB language data.
        </p>
      </div>
      <div className="max-w-xs space-y-1">
        <Label>Language</Label>
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {busy && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{pageStatus}</p>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={run} disabled={busy || files.length !== 1} className="bg-gradient-primary hover:opacity-90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ScanText className="h-4 w-4 mr-2" />}
          Extract text
        </Button>
        {result && (
          <Button variant="outline" onClick={downloadAgain}>
            <DownloadIcon className="h-4 w-4 mr-2" />
            Download .txt
          </Button>
        )}
      </div>
      {result && (
        <div className="space-y-1">
          <Label>Preview</Label>
          <Textarea value={result} readOnly className="min-h-48 font-mono text-xs" />
        </div>
      )}
    </Card>
  );
}
