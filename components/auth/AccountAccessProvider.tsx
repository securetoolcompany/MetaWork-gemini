'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Lock } from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import {
  getAccountGateCopy,
  requiresAccount,
} from '@/lib/auth/access-policy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AccountAccessContextValue = {
  requestAccess: (destination: string) => void;
};

const AccountAccessContext =
  createContext<AccountAccessContextValue | null>(null);

export function AccountAccessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const [destination, setDestination] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const closeDialog = () => {
    setDestination(null);
  };

  const requestAccess = (next: string) => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setDestination(next);
  };

  useEffect(() => {
    if (!destination || loading || !isAuthenticated) return;

    router.push(destination);
    setDestination(null);
  }, [destination, loading, isAuthenticated, router]);

  const pathname = destination?.split(/[?#]/)[0] || '/';
  const copy = getAccountGateCopy(pathname);

  const authHref = (mode: 'register' | 'login') => {
    const params = new URLSearchParams({
      mode,
      next: destination || '/dashboard',
    });

    return `/login?${params.toString()}`;
  };

  return (
    <AccountAccessContext.Provider value={{ requestAccess }}>
      {children}

      <Dialog
        open={destination !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-zinc-800 bg-zinc-950 p-7 text-zinc-50 sm:p-9"
          onCloseAutoFocus={(event) => {
            const opener = openerRef.current;

            if (opener?.isConnected) {
              event.preventDefault();
              opener.focus();
            }
          }}
        >
          <DialogHeader className="text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <Lock
                className="h-6 w-6 text-blue-400"
                aria-hidden="true"
              />
            </div>

            <p className="pb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
              Your MetaWork account
            </p>

            <DialogTitle className="text-2xl font-bold leading-tight tracking-tight">
              {copy.title}
            </DialogTitle>

            <DialogDescription className="pt-3 text-base leading-7 text-zinc-400">
              {copy.description}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div
              role="status"
              className="flex items-center gap-3 py-5 text-sm text-zinc-400"
            >
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Checking your account...
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <NextLink
                  href={authHref('register')}
                  onClick={closeDialog}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Create Free Account
                  <ArrowRight
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </NextLink>

                <NextLink
                  href={authHref('login')}
                  onClick={closeDialog}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  Sign In
                </NextLink>
              </div>

              <p className="text-xs leading-5 text-zinc-500">
                After signing in, you’ll continue to the tool you selected.
              </p>
            </>
          )}

          <div className="mt-3 border-t border-zinc-800 pt-5">
            <button
              type="button"
              onClick={closeDialog}
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Not now — keep exploring
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AccountAccessContext.Provider>
  );
}

type AccountLinkProps =
  ComponentPropsWithoutRef<typeof NextLink>;

export const AccountLink = forwardRef<
  HTMLAnchorElement,
  AccountLinkProps
>(function AccountLink(
  { onClick, prefetch, ...props },
  ref
) {
  const context = useContext(AccountAccessContext);
  const { isAuthenticated, loading } = useAuth();

  return (
    <NextLink
      {...props}
      ref={ref}
      prefetch={
        loading || !isAuthenticated ? false : prefetch
      }
      onClick={(event) => {
        // Preserve modified clicks and new-tab behavior.
        // Direct navigation still meets the full-page gateway.
        const isNormalClick =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          (!event.currentTarget.target ||
            event.currentTarget.target === '_self') &&
          !event.currentTarget.hasAttribute('download');

        if (
          !isNormalClick ||
          (!loading && isAuthenticated) ||
          !context
        ) {
          onClick?.(event);
          return;
        }

        const url = new URL(
          event.currentTarget.href,
          window.location.origin
        );

        const isProtected =
          url.origin === window.location.origin &&
          requiresAccount(url.pathname);

        if (!isProtected) {
          onClick?.(event);
          return;
        }

        // Run existing handlers, including mobile-menu close.
        onClick?.(event);

        if (event.defaultPrevented) return;

        event.preventDefault();

        const destination =
          url.pathname + url.search + url.hash;

        // Allow a mobile Sheet to finish closing before
        // opening another modal and handing over focus.
        window.setTimeout(() => {
          context.requestAccess(destination);
        }, 200);
      }}
    />
  );
});