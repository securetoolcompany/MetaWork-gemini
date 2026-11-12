'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ModelViewer from './ModelViewer';
import { checkStlSize, parseStl } from '@/lib/model-viewer/parse-stl';

const COLORS = [
  ['Glacier', '#60a5fa'],
  ['Silver', '#cbd5e1'],
  ['Jade', '#34d399'],
  ['Copper', '#fb923c'],
];

const buttonClass =
  'inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40';

function Control({ active = false, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`${buttonClass} ${
        active
          ? 'border-blue-400/50 bg-blue-500/15 text-blue-200'
          : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KiB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatExtent(value) {
  if (value === 0) return '0';
  if (Math.abs(value) < 0.001 || Math.abs(value) >= 1e7) {
    return value.toExponential(4);
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function ModelViewerWorkbench() {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [color, setColor] = useState(COLORS[0][1]);
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const inputRef = useRef(null);
  const studioRef = useRef(null);
  const generationRef = useRef(0);
  const abortRef = useRef(null);
  const dragDepthRef = useRef(0);

  const loadModel = useCallback(async (file = null) => {
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      let bytes;
      const filename = file ? file.name : 'metawork-demo.stl';

      if (file) {
        if (!/\.stl$/i.test(filename)) {
          throw new Error('Choose an STL file (.stl). Other formats are not supported yet.');
        }
        checkStlSize(file.size);
        bytes = await file.arrayBuffer();
      } else {
        const response = await fetch('/models/metawork-demo.stl', {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('The bundled demo could not be loaded. Try Restore demo.');
        const length = response.headers.get('content-length');
        if (length && Number(length) > 0) checkStlSize(Number(length));
        bytes = await response.arrayBuffer();
      }

      if (generation !== generationRef.current) return;
      const parsed = parseStl(bytes);

      if (generation !== generationRef.current) {
        parsed.geometry.dispose();
        return;
      }

      setModel({ ...parsed, filename, isDemo: !file });
    } catch (failure) {
      if (generation !== generationRef.current || controller.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : 'The model could not be opened.');
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModel();
    return () => {
      generationRef.current++;
      abortRef.current?.abort();
    };
  }, [loadModel]);

  useEffect(() => {
    return () => model?.geometry.dispose();
  }, [model]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setNativeFullscreen(document.fullscreenElement === studioRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!expanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === studioRef.current) {
        await document.exitFullscreen();
      } else if (expanded) {
        setExpanded(false);
      } else if (studioRef.current?.requestFullscreen) {
        await studioRef.current.requestFullscreen();
      } else {
        setExpanded(true);
        setNotice('Expanded view. Press Escape or Exit fullscreen to return.');
      }
    } catch {
      setExpanded(true);
      setNotice('Browser fullscreen is unavailable. Using expanded view; press Escape to return.');
    }
  }

  function hasFiles(event) {
    return Array.from(event.dataTransfer.types).includes('Files');
  }

  const stats = model?.stats;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section
        ref={studioRef}
        aria-label="Model inspection studio"
        className={`flex min-w-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950 ${
          expanded
            ? 'fixed inset-0 z-[100] h-[100dvh] rounded-none'
            : nativeFullscreen
              ? 'h-full rounded-none'
              : 'rounded-2xl'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/70 p-3">
          <Control
            className="border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
            onClick={() => inputRef.current?.click()}
          >
            Open STL
          </Control>
          <Control onClick={() => loadModel()}>Restore demo</Control>
          <div className="mx-1 hidden h-6 w-px bg-zinc-700 sm:block" />
          <Control disabled={!model} onClick={() => setResetKey(value => value + 1)}>
            Reset / fit
          </Control>
          <Control disabled={!model} active={!wireframe} aria-pressed={!wireframe} onClick={() => setWireframe(false)}>
            Solid
          </Control>
          <Control disabled={!model} active={wireframe} aria-pressed={wireframe} onClick={() => setWireframe(true)}>
            Wireframe
          </Control>
          <Control disabled={!model} active={autoRotate} aria-pressed={autoRotate} onClick={() => setAutoRotate(value => !value)}>
            Auto-rotate
          </Control>
          <Control disabled={!model} active={showGrid} aria-pressed={showGrid} onClick={() => setShowGrid(value => !value)}>
            Grid
          </Control>
          <Control onClick={toggleFullscreen}>
            {expanded || nativeFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Control>
        </div>

        <div
          className={`relative min-h-[360px] ${
            expanded || nativeFullscreen ? 'flex-1' : 'h-[58vh] sm:h-[65vh]'
          }`}
          aria-busy={loading}
          onDragEnter={event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepthRef.current++;
            setDragging(true);
          }}
          onDragOver={event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={event => {
            event.preventDefault();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (!dragDepthRef.current) setDragging(false);
          }}
          onDrop={event => {
            event.preventDefault();
            dragDepthRef.current = 0;
            setDragging(false);
            const files = event.dataTransfer.files;
            if (files.length !== 1) {
              setError('Drop one STL file at a time.');
              return;
            }
            loadModel(files[0]);
          }}
        >
          {model ? (
            <ModelViewer
              geometry={model.geometry}
              color={color}
              wireframe={wireframe}
              autoRotate={autoRotate}
              showGrid={showGrid}
              resetKey={resetKey}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#090d16] px-8 text-center text-sm text-zinc-400">
              {loading ? 'Preparing your studio…' : 'Open an STL or restore the demo to begin.'}
            </div>
          )}
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-zinc-950/75 px-3 py-1.5 text-[11px] font-medium tracking-wide text-zinc-300">
            {model?.isDemo ? 'DEMO MODEL' : model ? 'LOCAL PREVIEW' : 'STL STUDIO'}
          </div>
          {loading && (
            <div role="status" className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-blue-500/30 bg-zinc-950/90 px-4 py-2 text-sm text-blue-200">
              Opening model…
            </div>
          )}
          {dragging && (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-blue-950/80 text-lg font-medium text-blue-100">
              Drop one STL to preview
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3">
          <p className="text-xs leading-5 text-zinc-500">
            Drag to orbit · Scroll / pinch to zoom · Right-drag / two fingers to pan
          </p>
          <div className="flex items-center gap-2" aria-label="Model display color">
            {COLORS.map(([name, value]) => (
              <button
                key={value}
                type="button"
                title={name}
                aria-label={`${name} display color`}
                aria-pressed={color === value}
                onClick={() => setColor(value)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  color === value ? 'border-zinc-300' : 'border-zinc-800'
                }`}
              >
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: value }} />
              </button>
            ))}
          </div>
        </footer>
        {notice && <p role="status" className="border-t border-zinc-800 px-4 py-3 text-xs text-blue-200">{notice}</p>}
        {error && (
          <div role="alert" className="border-t border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
            {error}
            {model && <span className="mt-1 block text-xs text-zinc-400">The previous model remains displayed.</span>}
          </div>
        )}
      </section>

      <aside className="self-start rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Model information</p>
        <h2 className="mt-4 break-all text-lg font-medium text-zinc-100">
          {model?.filename ?? 'No model selected'}
        </h2>
        <p className="mt-2 text-xs text-blue-300">
          {model ? (model.isDemo ? 'Bundled demo · Local preview' : 'Selected file · Local preview') : 'Waiting for model'}
        </p>
        <dl className="mt-6 space-y-4 text-sm">
          {[
            ['Format', stats ? 'STL' : '—'],
            ['Encoding', stats?.encoding ?? '—'],
            ['File size', stats ? formatBytes(stats.byteLength) : '—'],
            ['Triangles', stats ? stats.triangleCount.toLocaleString() : '—'],
            ['X extent', stats ? formatExtent(stats.extents.x) : '—'],
            ['Y extent', stats ? formatExtent(stats.extents.y) : '—'],
            ['Z extent', stats ? formatExtent(stats.extents.z) : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-right font-mono text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Extents are in model units. STL does not specify physical units.
        </p>
        <div className="mt-6 border-t border-zinc-800 pt-5 text-xs leading-6 text-zinc-400">
          <p>Drop an STL onto the viewport or choose Open STL.</p>
          <p className="mt-3">Preview limits: 100 MiB and 2,000,000 triangles. Large models may take longer to open or run slowly on some devices. No source repairs are applied.</p>
          <p className="mt-3 text-zinc-500">Viewing only—not tokenization or print-readiness validation.</p>
        </div>
      </aside>
      <input
        ref={inputRef}
        type="file"
        accept=".stl"
        aria-label="Select an STL file"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) loadModel(file);
        }}
      />
    </div>
  );
}
