import { safeFilename } from "../utils/text.js";

export function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return new TextEncoder().encode(String(data));
}

export async function saveBinary(data, defaultFilename, mimeType = "application/octet-stream") {
  const filename = safeFilename(defaultFilename, "TEIAS-YHDA-cikti");
  if (isTauriRuntime()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs")
    ]);
    const extension = filename.includes(".") ? filename.split(".").at(-1) : "bin";
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "TEİAŞ-YHDA çıktısı", extensions: [extension] }]
    });
    if (!path) return false;
    await writeFile(path, await toBytes(data));
    return true;
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
  return true;
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

