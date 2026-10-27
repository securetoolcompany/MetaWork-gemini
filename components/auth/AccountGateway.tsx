'use client';

import {
  Suspense,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  usePathname,
  useSearchParams,
} from 'next/navigation';
import {
  ArrowRight,
  Loader2,
  Lock,
  Store,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { requiresAccount } from '@/lib/auth/access-policy';

type AccountGatewayProps = {
  children: ReactNode;
};

function LoadingAccount() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] items-center justify-center gap-3 text-zinc-400"
    >
      <Loader2
        className="h-5 w-5 animate-spin"
        aria-hidden="true"
      />
      <span className="text-sm">Checking your account...</span>
    </div>
  );
}

function GatewayContent({
  children,
}: AccountGatewayProps) {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();

  if (!requiresAccount(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return <LoadingAccount />;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ''}`;

  const createAccountParams = new URLSearchParams({
    mode: 'register',
    next: returnTo,
  });

  const signInParams = new URLSearchParams({
    mode: 'login',
    next: returnTo,
  });

  const isProductCreator =
    pathname === '/products/creator' ||
    pathname.startsWith('/products/creator/');

  const isAisleBuilder =
    pathname === '/aisle-settings' ||
    pathname.startsWith('/aisle-settings/');

  const title = isProductCreator
    ? 'Create a free account to start designing.'
    : isAisleBuilder
      ? 'Your creator storefront starts here.'
      : 'Sign in to your MetaWork workspace.';

  const description = isProductCreator
    ? 'Save your products, manage your designs, and publish them to your own Aisle.'
    : isAisleBuilder
      ? 'Create a free account to build your Aisle, publish products, and manage your collection.'
      : 'Create a free account or sign in to access your tools, manage your work, and track your activity.';

  return (
    <section className="flex min-h-full w-full items-center justify-center bg-zinc-950 px-5 py-10 sm:px-8">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/70 p-7 shadow-2xl sm:p-9">
        <div className="mb-6 inline-flex rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
          {isAisleBuilder ? (
            <Store
              className="h-7 w-7 text-blue-400"
              aria-hidden="true"
            />
          ) : (
            <Lock
              className="h-7 w-7 text-blue-400"
              aria-hidden="true"
            />
          )}
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400">
          Your MetaWork account
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-white">
          {title}
        </h1>

        <p className="mt-4 leading-7 text-zinc-400">
          {description}
        </p>

        <p className="mt-4 text-sm text-zinc-500">
          After signing in, you’ll return here to continue.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/login?${createAccountParams.toString()}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Create Free Account
            <ArrowRight
              className="h-4 w-4"
              aria-hidden="true"
            />
          </Link>

          <Link
            href={`/login?${signInParams.toString()}`}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-8 border-t border-zinc-800 pt-5">
          <p className="mb-3 text-sm text-zinc-500">
            Just exploring?
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <Link
              href="/showroom"
              className="text-blue-400 hover:text-blue-300"
            >
              Explore the Showroom
            </Link>

            <Link
              href="/catalog"
              className="text-blue-400 hover:text-blue-300"
            >
              Browse the Catalog
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AccountGateway({
  children,
}: AccountGatewayProps) {
  return (
    <Suspense fallback={<LoadingAccount />}>
      <GatewayContent>{children}</GatewayContent>
    </Suspense>
  );
}