import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Lock } from "lucide-react";
import { PDFDocument } from "@cantoo/pdf-lib";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndRecord, downloadBlob } from "@/lib/files";

type Props = { files: { file: File; pageCount: number }[] };

export default function EncryptPanel({ files }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [userPwd, setUserPwd] = useState("");
  const [ownerPwd, setOwnerPwd] = useState("");
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(false);
  const [allowModify, setAllowModify] = useState(false);

  const run = async () => {
    if (files.length !== 1) return toast.error("Add exactly 1 PDF");
    if (!userPwd) return toast.error("Enter a user password");
    setBusy(true);
    try {
      const buf = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const bytes = await pdf.save({
        userPassword: userPwd,
        ownerPassword: ownerPwd || userPwd,
        permissions: {
          printing: allowPrint ? "highResolution" : undefined,
          copying: allowCopy,
          modifying: allowModify,
        },
      } as Parameters<typeof pdf.save>[0]);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const name = `encrypted-${files[0].file.name}`;
      downloadBlob(blob, name);
      if (user) await uploadAndRecord(user.id, blob, name, "pdf", "encrypt", "password protected");
      toast.success("PDF encrypted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Password protect</h3>
        <p className="text-sm text-muted-foreground">Encrypt your PDF with a password and permissions.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 max-w-md">
        <div className="space-y-1">
          <Label htmlFor="upwd">User password</Label>
          <Input id="upwd" type="password" value={userPwd} onChange={(e) => setUserPwd(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="opwd">Owner password (optional)</Label>
          <Input id="opwd" type="password" value={ownerPwd} onChange={(e) => setOwnerPwd(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Permissions</Label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allowPrint} onCheckedChange={(v) => setAllowPrint(!!v)} /> Allow printing
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allowCopy} onCheckedChange={(v) => setAllowCopy(!!v)} /> Allow copying text
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allowModify} onCheckedChange={(v) => setAllowModify(!!v)} /> Allow editing
          </label>
        </div>
      </div>
      <Button onClick={run} disabled={busy || files.length !== 1} className="bg-gradient-primary hover:opacity-90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
        Encrypt & download
      </Button>
    </Card>
  );
}
