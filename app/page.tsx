'use client';

import { useState } from 'react';
import { AccountLink as Link } from '@/components/auth/AccountAccessProvider';
import {
  ArrowRight,
  Palette,
  ShoppingBag,
  TrendingUp,
  Wrench,
  Store,
  Package,
  FolderOpen,
  Network,
  HandCoins,
  GraduationCap,
  Check,
  BookOpen,
  Shield, 
  Coins, 
  Upload
} from 'lucide-react';

const paths = [
  {
    id: 'create',
    audience: 'Creator',
    title: 'Create & Sell',
    icon: Palette,
    description:
      'Turn your ideas into products and publish them to your own Aisle—your creator storefront.',
    cta: 'Start Creating',
    href: '/products/creator',
    color: 'text-purple-400',
    background: 'bg-purple-500/10',
    border: 'hover:border-purple-400/60',
    active: 'border-purple-400/60 bg-purple-500/10 text-white',
    heading: 'Your ideas. Your products. Your Aisle.',
    detail:
      'Bring your artwork, designs, or brand. Create products and give shoppers a place to discover and buy your work.',
    benefits: [
      'Create products from your artwork and designs',
      'Publish your collection to your own Aisle',
      'Manage your IP, products, and earnings',
    ],
    links: [
      {
        label: 'Create a Product',
        href: '/products/creator',
        icon: Palette,
      },
      {
        label: 'Set Up Your Aisle',
        href: '/aisle-settings',
        icon: Store,
      },
      {
        label: 'Manage Your IP',
        href: '/my-ip',
        icon: FolderOpen,
      },
    ],
  },
  {
    id: 'shop',
    audience: 'Shopper',
    title: 'Shop',
    icon: ShoppingBag,
    description:
      'Discover original products and buy directly from your favorite creators’ Aisles.',
    cta: 'Explore the Showroom',
    href: '/showroom',
    color: 'text-blue-400',
    background: 'bg-blue-500/10',
    border: 'hover:border-blue-400/60',
    active: 'border-blue-400/60 bg-blue-500/10 text-white',
    heading: 'Find your next favorite creator.',
    detail:
      'An Aisle is a creator’s storefront. Explore their collection, discover the designs behind their products, and buy the work you love.',
    benefits: [
      'Discover creators and their Aisles',
      'Browse original merchandise and products',
      'Explore the IP behind the designs',
    ],
    links: [
      {
        label: 'Browse the Showroom',
        href: '/showroom',
        icon: ShoppingBag,
      },
      {
        label: 'How Selling Works',
        href: '/metawork-overview/selling',
        icon: Store,
      },
    ],
  },
  {
    id: 'invest',
    audience: 'Investor',
    title: 'Invest & Earn',
    icon: TrendingUp,
    description:
      'Explore Revenue Products and the operations, earnings, and participation terms behind them.',
    cta: 'Explore Revenue Products',
    href: '/tokenized-funds',
    color: 'text-emerald-400',
    background: 'bg-emerald-500/10',
    border: 'hover:border-emerald-400/60',
    active: 'border-emerald-400/60 bg-emerald-500/10 text-white',
    heading: 'Explore the revenue behind the opportunity.',
    detail:
      'Revenue Products connect participation with defined revenue streams. Review the underlying operation, understand the terms, and track available earnings and distributions.',
    benefits: [
      'Explore listed revenue-sharing opportunities',
      'Review operations, fees, and participation terms',
      'Track earnings and available distributions',
    ],
    links: [
      {
        label: 'Explore Revenue Products',
        href: '/tokenized-funds',
        icon: TrendingUp,
      },
      {
        label: 'Explore Nillion Nodes',
        href: '/tokenized-funds/nillion',
        icon: Network,
      },
      {
        label: 'Claim Distributions',
        href: '/claim',
        icon: HandCoins,
      },
    ],
  },
  {
  id: 'business',
  audience: 'Investor / Creator / Business Owner',
  title: 'Tokenize',
  icon: Coins,
  description:
    'Give your work a lasting record and share the revenue it helps create.',
  cta: 'Explore Tokenization',
  href: '/metawork-overview/tokenization',
  color: 'text-amber-400',
  background: 'bg-amber-500/10',
  border: 'hover:border-amber-400/60',
  active: 'border-amber-400/60 bg-amber-500/10 text-white',
  heading: 'Your work has value. Put it to work.',
  detail:
    'Created a design, built a product, or run something that earns money? Learn how tokenization can give your original work a lasting blockchain record and help you set up how revenue is shared with collaborators and other participants.',
  benefits: [
    'Create a lasting blockchain record for your original work',
    'Decide who shares in revenue and how much they receive',
    'Understand the process before you get started',
  ],
  links: [
    {
      label: 'Tokenization Overview',
      href: '/metawork-overview/tokenization',
      icon: BookOpen,
    },
    {
      label: 'Minting & Authentication',
      href: '/mint-authentication',
      icon: Shield,
    },
    {
      label: 'Revenue Tokenization',
      href: '/revenue-tokenization',
      icon: Coins,
    },
    {
      label: 'Upload & Tokenize IP',
      href: '/upload-ip',
      icon: Upload,
    },
  ],
},
] as const;

type PathId = (typeof paths)[number]['id'];

export default function WelcomePage() {
  const [activePath, setActivePath] = useState<PathId>('create');

  const selectedPath =
    paths.find((path) => path.id === activePath) ?? paths[0];

  const SelectedIcon = selectedPath.icon;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30">
      {/* All four entry points appear before the walkthrough. */}
      <section
        aria-labelledby="welcome-heading"
        className="relative overflow-hidden border-b border-zinc-800/70"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-blue-500/5 to-transparent"
        />

        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
              Welcome to MetaWork
            </p>

            <h1
              id="welcome-heading"
              className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              Create. Shop. Invest.
              <span className="block text-zinc-400">
                Build your business.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Sell your creations, discover original products, explore
              revenue-sharing opportunities, or put Web3 tools to work.
            </p>
          </div>

          <div className="mb-5 mt-10 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Choose your path</h2>
            <p className="text-sm text-zinc-500">
              Start anywhere. You don’t have to do it all.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {paths.map((path) => {
              const Icon = path.icon;

              return (
                <Link
                  key={path.id}
                  href={path.href}
                  className={`group flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${path.border}`}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <span
                      className={`rounded-xl p-3 ${path.background} ${path.color}`}
                    >
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="text-xs text-zinc-500">
                      {path.audience}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold">{path.title}</h3>

                  <p className="mb-6 mt-3 flex-1 text-sm leading-6 text-zinc-400">
                    {path.description}
                  </p>

                  <span
                    className={`flex items-center justify-between gap-2 text-sm font-semibold ${path.color}`}
                  >
                    {path.cta}
                    <ArrowRight
                      className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* A compact walkthrough, not four long audience sales pages. */}
      <section
        aria-labelledby="walkthrough-heading"
        className="mx-auto max-w-7xl px-5 py-14 sm:px-8"
      >
        <div className="mb-7 max-w-2xl">
          <h2
            id="walkthrough-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            How will you use MetaWork?
          </h2>
          <p className="mt-3 leading-7 text-zinc-400">
            Create something and list it for sale. Discover what others
            have made. Explore revenue opportunities. Build the business
            behind it all.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Explore MetaWork paths"
          className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4"
        >
          {paths.map((path, index) => {
            const Icon = path.icon;
            const isActive = activePath === path.id;

            return (
              <button
                key={path.id}
                id={`path-tab-${path.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`path-panel-${path.id}`}
                onClick={() => setActivePath(path.id)}
                onKeyDown={(event) => {
                  let nextIndex = index;

                  if (event.key === 'ArrowRight') {
                    nextIndex = (index + 1) % paths.length;
                  } else if (event.key === 'ArrowLeft') {
                    nextIndex =
                      (index - 1 + paths.length) % paths.length;
                  } else if (event.key === 'Home') {
                    nextIndex = 0;
                  } else if (event.key === 'End') {
                    nextIndex = paths.length - 1;
                  } else {
                    return;
                  }

                  event.preventDefault();
                  const nextPath = paths[nextIndex];
                  setActivePath(nextPath.id);
                  document
                    .getElementById(`path-tab-${nextPath.id}`)
                    ?.focus();
                }}
                tabIndex={isActive ? 0 : -1}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive
                    ? path.active
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {path.title}
              </button>
            );
          })}
        </div>

        <div
          id={`path-panel-${selectedPath.id}`}
          role="tabpanel"
          aria-labelledby={`path-tab-${selectedPath.id}`}
          tabIndex={0}
          className="grid gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 sm:p-8 lg:grid-cols-2 lg:gap-12"
        >
          <div>
            <SelectedIcon
              className={`mb-5 h-8 w-8 ${selectedPath.color}`}
              aria-hidden="true"
            />

            <h3 className="text-2xl font-bold tracking-tight">
              {selectedPath.heading}
            </h3>

            <p className="mt-4 leading-7 text-zinc-400">
              {selectedPath.detail}
            </p>

            <ul className="mt-6 space-y-3">
              {selectedPath.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 text-sm leading-6 text-zinc-300"
                >
                  <Check
                    className={`mt-1 h-4 w-4 shrink-0 ${selectedPath.color}`}
                    aria-hidden="true"
                  />
                  {benefit}
                </li>
              ))}
            </ul>

            {activePath === 'create' && (
              <p className="mt-6 text-xs leading-5 text-zinc-500">
                Planned: shared advertising revenue from traffic to
                eligible creator Aisles. Not currently available.
              </p>
            )}

            {activePath === 'invest' && (
              <p className="mt-6 text-xs leading-5 text-zinc-500">
                Earnings vary and are not guaranteed. Participation and
                distribution rights depend on the applicable agreement.
                Dashboard estimates are not confirmed payouts.
              </p>
            )}
          </div>

          <div className="flex flex-col justify-center gap-3">
            {selectedPath.links.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 transition-colors hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${selectedPath.color}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-sm font-medium">
                    {link.label}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-800/70 bg-zinc-900/20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-3">
              <GraduationCap
                className="h-6 w-6 text-blue-400"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold">
                New to all of this?
              </h2>
            </div>
            <p className="leading-7 text-zinc-400">
              Start with MetaWork Academy. Learn about wallets,
              tokenization, creator commerce, and revenue sharing at
              your own pace.
            </p>
          </div>

          <Link
            href="/academy"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold transition-colors hover:bg-zinc-800"
          >
            Explore the Academy
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-zinc-500 sm:px-8 md:flex-row md:items-center md:justify-between">
        <p>MetaWork · Create. Shop. Invest. Build.</p>
        <div className="flex flex-wrap gap-5">
          <Link href="/about-us" className="hover:text-white">
            About
          </Link>
          <Link href="/whitepaper" className="hover:text-white">
            Whitepaper
          </Link>
          <Link href="/login" className="hover:text-white">
            Sign In / Create Account
          </Link>
        </div>
      </footer>
    </div>
  );
}