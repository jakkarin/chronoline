import { useEffect, useRef, useState, useCallback } from 'react';

interface PresentOverlayProps {
  html: string;
  title: string;
  onClose: () => void;
}

interface PreviewLayout {
  html: string;
  width: number;
  height: number;
  fitScale: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface ViewportAnchor {
  clientX: number;
  clientY: number;
}

interface TouchPoint {
  clientX: number;
  clientY: number;
}

const PREVIEW_FRAME_PADDING = 16;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const WHEEL_ZOOM_STEP = 1.12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDistance(a: TouchPoint, b: TouchPoint) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function getMidpoint(a: TouchPoint, b: TouchPoint): ViewportAnchor {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
}

function safeSetPointerCapture(target: HTMLDivElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Some browsers and synthetic pointer events do not expose an active pointer for capture.
  }
}

function safeReleasePointerCapture(target: HTMLDivElement, pointerId: number) {
  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // Ignore missing pointer capture on cleanup paths.
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)![1];
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export function PresentOverlay({ html, title, onClose }: PresentOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const pinchPointersRef = useRef<Map<number, TouchPoint>>(new Map());
  const pinchStateRef = useRef<{
    startDistance: number;
    startZoom: number;
  } | null>(null);
  const didInitializeScrollRef = useRef<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const frameLoaded = loadedHtml === html && previewLayout?.html === html;
  const activeLayout = previewLayout?.html === html ? previewLayout : null;
  const previewScale = activeLayout ? activeLayout.fitScale * zoom : 1;
  const scaledWidth = activeLayout ? activeLayout.width * previewScale : 0;
  const scaledHeight = activeLayout ? activeLayout.height * previewScale : 0;
  const stageWidth = activeLayout
    ? Math.max(Math.ceil(scaledWidth + PREVIEW_FRAME_PADDING * 2), activeLayout.viewportWidth)
    : null;
  const stageHeight = activeLayout
    ? Math.max(Math.ceil(scaledHeight + PREVIEW_FRAME_PADDING * 2), activeLayout.viewportHeight)
    : null;
  const frameLeft = activeLayout && stageWidth
    ? Math.max(Math.round((stageWidth - scaledWidth) / 2), PREVIEW_FRAME_PADDING)
    : PREVIEW_FRAME_PADDING;
  const frameTop = activeLayout && stageHeight
    ? Math.max(Math.round((stageHeight - scaledHeight) / 2), PREVIEW_FRAME_PADDING)
    : PREVIEW_FRAME_PADDING;
  const canPan = Boolean(
    activeLayout && stageWidth && stageHeight &&
    (stageWidth > activeLayout.viewportWidth || stageHeight > activeLayout.viewportHeight)
  );

  const waitForFrameFonts = useCallback(async () => {
    const fontReady = iframeRef.current?.contentDocument?.fonts?.ready;
    if (!fontReady) return;

    await Promise.race([
      fontReady.catch(() => undefined),
      sleep(5000),
    ]);
  }, []);

  const syncPreviewLayout = useCallback(() => {
    const iframe = iframeRef.current;
    const viewport = previewViewportRef.current;
    const doc = iframe?.contentDocument;
    const content = doc?.getElementById('content');

    if (!iframe || !viewport || !doc || !content) return false;

    const width = Math.ceil(content.scrollWidth);
    const height = Math.ceil(content.scrollHeight);

    if (!width || !height) return false;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const availableWidth = Math.max(viewportWidth - PREVIEW_FRAME_PADDING * 2, 1);
    const availableHeight = Math.max(viewportHeight - PREVIEW_FRAME_PADDING * 2, 1);
    const fitScale = Math.min(availableWidth / width, availableHeight / height, 1);

    setPreviewLayout((current) => {
      if (
        current &&
        current.html === html &&
        current.width === width &&
        current.height === height &&
        current.viewportWidth === viewportWidth &&
        current.viewportHeight === viewportHeight &&
        Math.abs(current.fitScale - fitScale) < 0.001
      ) {
        return current;
      }

      return { html, width, height, fitScale, viewportWidth, viewportHeight };
    });

    return true;
  }, [html]);

  const adjustZoom = useCallback((nextZoom: number, anchor?: ViewportAnchor) => {
    const viewport = previewViewportRef.current;
    const layout = previewLayout?.html === html ? previewLayout : null;

    setZoom((currentZoom) => {
      const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (!viewport || !layout || Math.abs(clampedZoom - currentZoom) < 0.001) {
        return clampedZoom;
      }

      const currentScale = layout.fitScale * currentZoom;
      const nextScale = layout.fitScale * clampedZoom;

      if (currentScale <= 0 || nextScale <= 0) {
        return clampedZoom;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const anchorX = anchor
        ? clamp(anchor.clientX - viewportRect.left, 0, viewport.clientWidth)
        : viewport.clientWidth / 2;
      const anchorY = anchor
        ? clamp(anchor.clientY - viewportRect.top, 0, viewport.clientHeight)
        : viewport.clientHeight / 2;

      const centerX = viewport.scrollLeft + anchorX;
      const centerY = viewport.scrollTop + anchorY;
      const relativeCenterX = centerX / currentScale;
      const relativeCenterY = centerY / currentScale;

      requestAnimationFrame(() => {
        const nextCenterX = relativeCenterX * nextScale;
        const nextCenterY = relativeCenterY * nextScale;

        viewport.scrollLeft = Math.max(nextCenterX - anchorX, 0);
        viewport.scrollTop = Math.max(nextCenterY - anchorY, 0);
      });

      return clampedZoom;
    });
  }, [html, previewLayout]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = previewViewportRef.current;
    if (!viewport || !frameLoaded) return;

    if (event.pointerType === 'touch') {
      pinchPointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });

      if (pinchPointersRef.current.size === 2) {
        const [firstPoint, secondPoint] = Array.from(pinchPointersRef.current.values());
        const startDistance = getDistance(firstPoint, secondPoint);

        if (startDistance > 0) {
          pinchStateRef.current = {
            startDistance,
            startZoom: zoom,
          };
        }

        if (panStateRef.current) {
          safeReleasePointerCapture(event.currentTarget, panStateRef.current.pointerId);
        }

        panStateRef.current = null;
        setIsPanning(false);
      }
    }

    const isMousePan = event.pointerType === 'mouse' && event.button === 0;
    const isTouchPan = event.pointerType === 'touch' && pinchPointersRef.current.size === 1;

    if (!canPan || (!isMousePan && !isTouchPan)) return;

    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };

    setIsPanning(true);
    safeSetPointerCapture(event.currentTarget, event.pointerId);
  }, [canPan, frameLoaded]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && pinchPointersRef.current.has(event.pointerId)) {
      pinchPointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });

      const pinchState = pinchStateRef.current;
      if (pinchState && pinchPointersRef.current.size >= 2) {
        const [firstPoint, secondPoint] = Array.from(pinchPointersRef.current.values());
        const distance = getDistance(firstPoint, secondPoint);

        if (pinchState.startDistance > 0 && distance > 0) {
          adjustZoom(
            pinchState.startZoom * (distance / pinchState.startDistance),
            getMidpoint(firstPoint, secondPoint)
          );
        }

        return;
      }
    }

    const panState = panStateRef.current;
    const viewport = previewViewportRef.current;

    if (!panState || !viewport || panState.pointerId !== event.pointerId) return;

    viewport.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
    viewport.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
  }, []);

  const endPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      pinchPointersRef.current.delete(event.pointerId);

      if (pinchPointersRef.current.size < 2) {
        pinchStateRef.current = null;
      }
    }

    if (panStateRef.current?.pointerId !== event.pointerId) return;

    panStateRef.current = null;
    setIsPanning(false);

    safeReleasePointerCapture(event.currentTarget, event.pointerId);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!frameLoaded) return;

    event.preventDefault();

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const zoomFactor = delta < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
    adjustZoom(zoom * zoomFactor, { clientX: event.clientX, clientY: event.clientY });
  }, [adjustZoom, frameLoaded, zoom]);

  const handleFrameLoad = useCallback(() => {
    const frameWindow = iframeRef.current?.contentWindow;

    void (async () => {
      await waitForFrameFonts();

      if (iframeRef.current?.contentWindow !== frameWindow) return;
      syncPreviewLayout();
      setLoadedHtml(html);
    })();
  }, [html, syncPreviewLayout, waitForFrameFonts]);

  useEffect(() => {
    if (!frameLoaded) return;

    syncPreviewLayout();

    const viewport = previewViewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      syncPreviewLayout();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [frameLoaded, syncPreviewLayout]);

  useEffect(() => {
    if (!frameLoaded) return;

    const viewport = previewViewportRef.current;
    if (!viewport || !stageWidth || !stageHeight || !activeLayout) return;

    if (didInitializeScrollRef.current === html) return;

    const maxScrollLeft = Math.max(stageWidth - activeLayout.viewportWidth, 0);
    const maxScrollTop = Math.max(stageHeight - activeLayout.viewportHeight, 0);
    const targetScrollLeft = Math.max((stageWidth - activeLayout.viewportWidth) / 2, 0);
    const targetScrollTop = Math.max((stageHeight - activeLayout.viewportHeight) / 2, 0);

    viewport.scrollLeft = clamp(targetScrollLeft, 0, maxScrollLeft);
    viewport.scrollTop = clamp(targetScrollTop, 0, maxScrollTop);
    didInitializeScrollRef.current = html;
  }, [activeLayout, frameLoaded, html, stageHeight, stageWidth]);

  useEffect(() => {
    didInitializeScrollRef.current = null;
    pinchPointersRef.current.clear();
    pinchStateRef.current = null;
    panStateRef.current = null;
  }, [html]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /** Trigger __capture() inside the iframe, wait for postMessage with dataURL */
  const captureFromIframe = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const iframe = iframeRef.current;
      if (!iframe) return reject(new Error('iframe not mounted'));
      let timer: ReturnType<typeof setTimeout> | null = null;

      const handler = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow) return;
        if (e.data?.type === 'CAPTURE_DONE') {
          if (timer) clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(dataUrlToBlob(e.data.dataUrl));
        } else if (e.data?.type === 'CAPTURE_ERROR') {
          if (timer) clearTimeout(timer);
          window.removeEventListener('message', handler);
          reject(new Error(e.data.message));
        }
      };

      const runCapture = async () => {
        // Poll until __capture function is available (iframe + html2canvas CDN loaded)
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((iframe.contentWindow as any)?.__capture) break;
          await sleep(200);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(iframe.contentWindow as any)?.__capture) {
          reject(new Error('html2canvas did not load in iframe'));
          return;
        }

        await waitForFrameFonts();

        timer = setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Capture timeout'));
        }, 30000);

        window.addEventListener('message', handler);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (iframe.contentWindow as any).__capture();
      };

      void runCapture();
    });
  }, [waitForFrameFonts]);

  const handleExportImage = useCallback(async () => {
    setExporting(true);
    await sleep(80);
    try {
      const blob = await captureFromIframe();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `${title.replace(/['"]/g, '')}.png`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert('Export failed: ' + (err as Error).message);
    } finally {
      setExporting(false);
    }
  }, [captureFromIframe, title]);

  const handleCopy = useCallback(async () => {
    setCopying(true);
    await sleep(80);
    try {
      const blob = await captureFromIframe();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Copy failed: ' + (err as Error).message);
    } finally {
      setCopying(false);
    }
  }, [captureFromIframe]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: '#1e293b', color: '#f1f5f9', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>📄 {title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => adjustZoom(zoom / 1.2)}
            disabled={!frameLoaded || zoom <= MIN_ZOOM}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#334155', color: '#e2e8f0', opacity: (!frameLoaded || zoom <= MIN_ZOOM) ? 0.5 : 1 }}
          >
            -
          </button>
          <button
            onClick={() => adjustZoom(1)}
            disabled={!frameLoaded}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#475569', color: '#f8fafc', opacity: frameLoaded ? 1 : 0.5 }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => adjustZoom(zoom * 1.2)}
            disabled={!frameLoaded || zoom >= MAX_ZOOM}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#334155', color: '#e2e8f0', opacity: (!frameLoaded || zoom >= MAX_ZOOM) ? 0.5 : 1 }}
          >
            +
          </button>
        </div>
        <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#334155', color: '#94a3b8' }}>
          Close
        </button>
        <button onClick={handleCopy} disabled={copying || exporting} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#7c3aed', color: '#fff', opacity: (copying || exporting) ? 0.5 : 1 }}>
          {copying ? 'Copying…' : copied ? '✓ Copied!' : 'Copy to Clipboard'}
        </button>
        <button onClick={handleExportImage} disabled={exporting || copying} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#0f766e', color: '#fff', opacity: (exporting || copying) ? 0.5 : 1 }}>
          {exporting ? 'Capturing…' : 'Export as Image'}
        </button>
      </div>

      {/* Preview — full HTML in isolated iframe, no app CSS leaking in */}
      <div
        ref={previewViewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={handleWheel}
        style={{
          position: 'relative',
          flex: 1,
          background: '#e2e8f0',
          overflow: 'auto',
          cursor: canPan ? (isPanning ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {!frameLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              color: '#64748b',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            Preparing present view…
          </div>
        )}
        <div
          style={{
            position: 'relative',
            width: stageWidth ?? '100%',
            height: stageHeight ?? '100%',
            minWidth: '100%',
            minHeight: '100%',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: frameLeft,
              top: frameTop,
              width: scaledWidth || '100%',
              height: scaledHeight || '100%',
              background: '#fff',
              boxShadow: frameLoaded ? '0 18px 48px rgba(15, 23, 42, 0.18)' : 'none',
              overflow: 'hidden',
            }}
          >
            <iframe
              key={html}
              ref={iframeRef}
              srcDoc={html}
              onLoad={handleFrameLoad}
              scrolling="no"
              style={{
                border: 'none',
                width: activeLayout?.width ?? '100%',
                height: activeLayout?.height ?? '100%',
                background: '#fff',
                opacity: frameLoaded ? 1 : 0,
                transform: activeLayout ? `scale(${previewScale})` : 'none',
                transformOrigin: 'top left',
                display: 'block',
                pointerEvents: 'none',
              }}
              title="Present Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
