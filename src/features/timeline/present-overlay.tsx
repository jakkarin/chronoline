import { useEffect, useRef, useState, useCallback } from 'react';

interface PresentOverlayProps {
  html: string;
  title: string;
  onClose: () => void;
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
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);
  const frameLoaded = loadedHtml === html;

  const waitForFrameFonts = useCallback(async () => {
    const fontReady = iframeRef.current?.contentDocument?.fonts?.ready;
    if (!fontReady) return;

    await Promise.race([
      fontReady.catch(() => undefined),
      sleep(5000),
    ]);
  }, []);

  const handleFrameLoad = useCallback(() => {
    const frameWindow = iframeRef.current?.contentWindow;

    void (async () => {
      await waitForFrameFonts();

      if (iframeRef.current?.contentWindow !== frameWindow) return;
      setLoadedHtml(html);
    })();
  }, [html, waitForFrameFonts]);

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
      <div style={{ position: 'relative', flex: 1, background: '#fff' }}>
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
        <iframe
          key={html}
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleFrameLoad}
          style={{
            flex: 1,
            border: 'none',
            width: '100%',
            height: '100%',
            background: '#fff',
            opacity: frameLoaded ? 1 : 0,
          }}
          title="Present Preview"
        />
      </div>
    </div>
  );
}
