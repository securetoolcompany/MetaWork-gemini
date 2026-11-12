import ModelViewerWorkbench from '@/components/model-viewer/ModelViewerWorkbench';

export const metadata = {
  title: '3D Model Studio | MetaWork',
  description: 'Inspect STL models locally in the MetaWork 3D Model Studio.',
};

export default function ModelViewerPage() {
  return (
    <div className="min-h-full bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-400">
            MetaWork / Creator tools
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            3D Model Studio
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Interactive STL preview. Selected files stay in your browser; this page does not upload or tokenize them.
          </p>
        </header>
        <ModelViewerWorkbench />
      </div>
    </div>
  );
}
