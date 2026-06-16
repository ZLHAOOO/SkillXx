import { invoke } from "@tauri-apps/api/core";
import { UpdateInfo } from "../types";

export async function checkUpdate(): Promise<UpdateInfo> {
  return await invoke("check_update");
}

export async function downloadAndInstall(
  downloadUrl: string,
  onProgress?: (percent: number, status: string) => void,
): Promise<void> {
  // Listen for progress events
  const unlisten = await (await import("@tauri-apps/api/event")).listen(
    "update:progress",
    (event) => {
      const payload = event.payload as {
        percent: number;
        downloaded: number;
        total: number;
        status: string;
      };
      onProgress?.(payload.percent, payload.status);
    },
  );

  try {
    await invoke("download_and_install", { downloadUrl });
  } finally {
    unlisten();
  }
}
