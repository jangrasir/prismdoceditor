import { supabase } from "@/integrations/supabase/client";

export type FileRecord = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  mime_type: string | null;
  size_bytes: number;
  storage_path: string;
  ai_tags: string[] | null;
  created_at: string;
};

export type HistoryRecord = {
  id: string;
  user_id: string;
  file_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
};

export async function uploadAndRecord(
  userId: string,
  blob: Blob,
  fileName: string,
  type: string,
  action: string,
  details?: string
): Promise<FileRecord> {
  const safeName = fileName.replace(/[^\w.\-() ]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage.from("user-files").upload(path, blob, {
    contentType: blob.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: fileRow, error: insErr } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      name: safeName,
      type,
      mime_type: blob.type || null,
      size_bytes: blob.size,
      storage_path: path,
    })
    .select()
    .single();
  if (insErr) throw insErr;

  await supabase.from("history").insert({
    user_id: userId,
    file_id: fileRow.id,
    action,
    details: details ?? null,
  });

  return fileRow as FileRecord;
}

export async function downloadFile(path: string, name: string) {
  const { data, error } = await supabase.storage.from("user-files").download(path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deleteFile(id: string, path: string) {
  await supabase.storage.from("user-files").remove([path]);
  await supabase.from("files").delete().eq("id", id);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
