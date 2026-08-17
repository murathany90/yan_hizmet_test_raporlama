import { safeFilename } from "../utils/text.js";
import { isTauri } from "@tauri-apps/api/core";

export function isTauriRuntime() {
  return typeof window !== "undefined" && isTauri();
}

async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return new TextEncoder().encode(String(data));
}

const MIME_FILE_TYPES = {
  "application/pdf": { extension: "pdf", label: "PDF belgesi" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: "docx", label: "Word belgesi" },
  "application/zip": { extension: "zip", label: "ZIP arşivi" },
  "text/csv": { extension: "csv", label: "CSV dosyası" },
  "image/png": { extension: "png", label: "PNG görseli" },
  "image/svg+xml": { extension: "svg", label: "SVG görseli" }
};

function fileTypeFor(filename, mimeType) {
  const configured = MIME_FILE_TYPES[String(mimeType).split(";")[0]];
  if (configured) return configured;
  const extension = String(filename).split(".").at(-1)?.toLowerCase();
  return {
    extension: extension && extension !== filename ? extension : "bin",
    label: "YDA çıktısı"
  };
}

function withExtension(filename, extension) {
  const suffix = `.${extension}`;
  return filename.toLowerCase().endsWith(suffix) ? filename : `${filename}${suffix}`;
}

function nativeErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Tauri hata nesnesi serileştirilemiyorsa, aşağıdaki güvenli metni kullan.
  }
  return "Bilinmeyen yerel dosya sistemi hatası";
}

export async function chooseOutputDirectory() {
  if (!isTauriRuntime()) return "";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "YDA çıktı klasörünü seçin"
  });
  return typeof selected === "string" ? selected : "";
}

export async function saveBinary(data, defaultFilename, mimeType = "application/octet-stream", outputDirectory = "") {
  const initialFilename = safeFilename(defaultFilename, "YDA-cikti");
  const fileType = fileTypeFor(initialFilename, mimeType);
  const filename = withExtension(initialFilename, fileType.extension);
  if (isTauriRuntime()) {
    const [{ save }, { writeFile }, { join }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
      import("@tauri-apps/api/path")
    ]);
    let path = "";
    if (String(outputDirectory).trim()) {
      path = await join(String(outputDirectory).trim(), filename);
    } else {
      const selected = await save({
        title: `${fileType.label} kaydet`,
        defaultPath: filename,
        filters: [{ name: fileType.label, extensions: [fileType.extension] }]
      });
      if (!selected) throw new Error("Dosya kaydetme işlemi iptal edildi.");
      path = withExtension(selected, fileType.extension);
    }
    try {
      await writeFile(path, await toBytes(data));
    } catch (error) {
      throw new Error(`${fileType.label} kaydedilemedi: ${nativeErrorMessage(error)}`);
    }
    return { native: true, path };
  }

  const blob = data instanceof Blob ? data : new Blob([await toBytes(data)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { native: false, path: "" };
}

export async function openCsvFilesNative() {
  if (!isTauriRuntime()) return [];
  const [{ open }, { readFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs")
  ]);
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "CSV", extensions: ["csv"] }]
  });
  if (!selected) return [];
  const paths = Array.isArray(selected) ? selected : [selected];
  return await Promise.all(paths.map(async (path) => ({
    name: String(path).split(/[\\/]/).at(-1),
    bytes: await readFile(path),
    path
  })));
}

export async function askReplace(message) {
  if (isTauriRuntime()) {
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    return await confirm(message, { title: "YDA", kind: "warning" });
  }
  return window.confirm(message);
}
