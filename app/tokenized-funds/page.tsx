// app/tokenized-funds/page.tsx

import Link from 'next/link';
import { ArrowRight, Network } from 'lucide-react';

export const metadata = {
  title: 'Tokenized Funds | MetaWork',
  description:
    'Explore MetaWork funds and track the revenue streams behind them.',
};

const funds = [
  {
    id: 'nillion',
    name: 'Nillion Nodes',
    category: 'Node Infrastructure',
    description:
      'Track managed Nillion Blacklight nodes, their NIL rewards, and your recorded participation.',
    href: '/tokenized-funds/nillion',
    distributionAsset: 'NIL',
    managementFee: '50% after applicable operating costs',
  },
];

export default function TokenizedFundsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
            MetaWork
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Tokenized Funds
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-400">
            Explore the revenue streams behind each fund. View the
            underlying operations, monitor earnings, and track your
            recorded participation.
          </p>
        </header>

        <section
          aria-labelledby="available-funds-heading"
          className="mt-12"
        >
          <h2
            id="available-funds-heading"
            className="text-xl font-semibold"
          >
            Explore funds
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {funds.map((fund) => (
              <Link
                key={fund.id}
                href={fund.href}
                className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/60 hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
                    <Network
                      className="h-6 w-6"
                      aria-hidden="true"
                    />
                  </span>

                  <span className="text-sm text-slate-400">
                    {fund.category}
                  </span>
                </div>

                <h3 className="mt-6 text-2xl font-semibold">
                  {fund.name}
                </h3>

                <p className="mt-3 flex-1 leading-7 text-slate-400">
                  {fund.description}
                </p>

                <dl className="mt-6 space-y-4 border-t border-slate-800 pt-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">
                      Distribution asset
                    </dt>
                    <dd className="text-right text-slate-200">
                      {fund.distributionAsset}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="shrink-0 text-slate-400">
                      Management fee
                    </dt>
                    <dd className="text-right text-slate-200">
                      {fund.managementFee}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex items-center justify-between text-sm font-medium text-blue-400">
                  <span>View nodes and earnings</span>
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-10 max-w-3xl text-sm leading-6 text-slate-500">
          Earnings vary and are not guaranteed. Dashboard estimates
          are not confirmed payouts. Participation and distribution
          rights are governed by the applicable agreement.
        </p>
      </div>
    </main>
  );
}