export {};

declare global {
  interface Window {
    electron?: {
      openFile: (options?: { exts?: string[] }) => Promise<string | null>;
    };
  }
}

