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

export async function chooseOutputDirectory() {
  if (!isTauriRuntime()) return "";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "TEİAŞ-YHDA çıktı klasörünü seçin"
  });
  return typeof selected === "string" ? selected : "";
}

export async function saveBinary(data, defaultFilename, mimeType = "application/octet-stream", outputDirectory = "") {
  const filename = safeFilename(defaultFilename, "TEIAS-YHDA-cikti");
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
      const extension = filename.includes(".") ? filename.split(".").at(-1) : "bin";
      const selected = await save({
        defaultPath: filename,
        filters: [{ name: "TEİAŞ-YHDA çıktısı", extensions: [extension] }]
      });
      if (!selected) throw new Error("Dosya kaydetme işlemi iptal edildi.");
      path = selected;
    }
    await writeFile(path, await toBytes(data));
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
    return await confirm(message, { title: "TEİAŞ-YHDA", kind: "warning" });
  }
  return window.confirm(message);
}
