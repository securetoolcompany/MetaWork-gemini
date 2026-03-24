import { Toaster } from 'sonner';

export default function AisleLayout({ children, modal }) {
  return (
    <div className="font-sans">
      {children}
      {modal}
      <Toaster position="top-center" richColors />
    </div>
  );
}
