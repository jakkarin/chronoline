declare module '@zumer/snapdom' {
  interface SnapResult {
    toCanvas(opts?: Record<string, unknown>): Promise<HTMLCanvasElement>;
    toBlob(opts?: Record<string, unknown>): Promise<Blob>;
    toPng(opts?: Record<string, unknown>): Promise<string>;
    toSvg(opts?: Record<string, unknown>): Promise<string>;
    toImg(opts?: Record<string, unknown>): Promise<HTMLImageElement>;
    download(opts?: Record<string, unknown>): Promise<void>;
  }
  export function snapdom(
    element: HTMLElement,
    options?: { scale?: number; backgroundColor?: string }
  ): Promise<SnapResult>;
}
