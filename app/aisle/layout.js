import { Toaster } from 'sonner';

export default function AisleLayout({ children }) {
  return (
    <div className="font-sans">
      {children}
      <Toaster position="top-center" richColors />
    </div>
  );
}
