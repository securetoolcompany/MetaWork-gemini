'use client';

import { AccountLink as Link } from '@/components/auth/AccountAccessProvider';
import {
  ArrowRight,
  ShieldCheck,
  Coins,
  Users,
  Wallet,
  Palette,
  Package,
  Building2,
  Network,
  Info,
} from 'lucide-react';

const examples = [
  {
    icon: Palette,
    title: 'Your artwork and designs',
    description:
      'Have a logo, illustration, or design? Record it on the blockchain and set up how you and your collaborators share money earned from its use.',
    status: 'Available through the IP workflow',
  },
  {
    icon: Package,
    title: 'Products you sell',
    description:
      'Create a product and decide how its revenue is shared. For example, a designer and a product creator can each receive an agreed share.',
    status: 'Available through product management',
  },
  {
    icon: Network,
    title: 'Operations that earn money',
    description:
      'Some operations earn money by providing a service. A Revenue Product explains how people can take part, what costs apply, and how earnings are shared.',
    status: 'See the currently listed Revenue Products',
  },
  {
    icon: Building2,
    title: 'Real-world projects',
    description:
      'Our longer-term goal includes projects such as community fiber networks, farms, and other businesses. Each project needs clear terms for funding, costs, and payments.',
    status: 'Planned expansion—not all project types are available',
  },
];

const steps = [
  {
    title: 'Choose what you want to tokenize',
    description:
      'Start with a design, product, or supported revenue source. Be clear about what people will receive.',
  },
  {
    title: 'Decide who gets what',
    description:
      'Choose who will share in the revenue and how much each person receives. Explain any fees, costs, or limits.',
  },
  {
    title: 'Set it up',
    description:
      'Follow the steps for that type of asset. Some steps require an account, credits, a connected wallet, and approval of blockchain transactions.',
  },
  {
    title: 'Earn revenue',
    description:
      'The product or operation must actually earn money. Creating tokens does not create income by itself.',
  },
  {
    title: 'Track and claim your share',
    description:
      'Review the recorded earnings. When a payment is available to you, use the applicable claim process to collect it.',
  },
];

export default function TokenizationOverviewPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            Tokenize · Start Here
          </p>

          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Make something valuable.
            <span className="block text-blue-400">
              Share what it earns.
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-zinc-400">
            You might create a design, sell a product, or run a project.
            MetaWork helps you record what you create and set up how
            revenue is shared with other people.
          </p>

          <div className="mt-7 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
            <h2 className="text-lg font-semibold text-blue-300">
              What does “tokenize” mean?
            </h2>

            <p className="mt-3 leading-7 text-zinc-300">
              It means using digital tokens to represent something
              specific—such as a share of a product’s revenue. The
              terms explain what each token gives its holder.
            </p>

            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Think of it as a way to record and divide agreed rights.
              A token does not automatically mean someone owns your
              artwork, your company, or everything it earns.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/revenue-tokenization"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Learn How Revenue Sharing Works
              <ArrowRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/tokenized-funds"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold transition hover:bg-zinc-900"
            >
              Explore Revenue Products
              <ArrowRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>
          </div>
        </header>

        <section
          className="mt-16"
          aria-labelledby="example-heading"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">
              A simple example
            </p>

            <h2
              id="example-heading"
              className="mt-3 text-2xl font-bold tracking-tight"
            >
              You make the artwork. Someone else makes the product.
            </h2>

            <p className="mt-4 max-w-3xl leading-8 text-zinc-400">
              You create a design. Another creator uses it on a
              shirt under agreed terms. When that shirt sells,
              money is set aside for the people entitled to a
              share—including you.
            </p>

            <p className="mt-4 max-w-3xl leading-8 text-zinc-400">
              MetaWork connects the design, the product, and the
              revenue-sharing setup so those shares can be tracked.
              Available payments can then be claimed.
            </p>

            <p className="mt-4 text-xs leading-6 text-zinc-500">
              The amount and timing depend on the product’s terms,
              costs, and payment process.
            </p>
          </div>
        </section>

        <section
          className="mt-16"
          aria-labelledby="two-parts-heading"
        >
          <h2
            id="two-parts-heading"
            className="text-2xl font-bold tracking-tight"
          >
            Record your work. Then decide how to share its revenue.
          </h2>

          <p className="mt-3 max-w-3xl leading-7 text-zinc-400">
            These are two different jobs. Recording an asset is
            not the same as giving someone a share of its earnings.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <ShieldCheck
                className="h-7 w-7 text-blue-400"
                aria-hidden="true"
              />

              <h3 className="mt-5 text-xl font-semibold">
                Give your original work a lasting record
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                You put time and talent into your work. Minting gives your
                artwork, logo, or design a permanent blockchain record—a
                lasting reference linked to the work you submit.
              </p>

              <p className="mt-3 text-sm leading-7 text-zinc-400">
                It’s a starting point for bringing your work into MetaWork,
                connecting it with products, and setting up how you share
                in the revenue it helps create.
              </p>

              <Link
                href="/mint-authentication"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300"
              >
                Learn About Minting &amp; Authentication
                <ArrowRight
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </Link>
            </article>

            <article className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <Coins
                className="h-7 w-7 text-purple-400"
                aria-hidden="true"
              />

              <h3 className="mt-5 text-xl font-semibold">
                Share the revenue
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                Revenue tokenization sets up how people take part
                in a defined revenue stream. Tokens can represent
                shares of the money set aside for that purpose.
              </p>

              <p className="mt-3 text-sm leading-7 text-zinc-500">
                The terms explain which revenue is included,
                what costs come out first, and who can receive
                payments.
              </p>

              <Link
                href="/revenue-tokenization"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-purple-400 hover:text-purple-300"
              >
                Learn About Revenue Tokenization
                <ArrowRight
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </Link>
            </article>
          </div>
        </section>

        <section
          className="mt-16"
          aria-labelledby="applications-heading"
        >
          <h2
            id="applications-heading"
            className="text-2xl font-bold tracking-tight"
          >
            What can you use it for?
          </h2>

          <p className="mt-3 max-w-3xl leading-7 text-zinc-400">
            MetaWork starts with IP, products, and listed revenue
            opportunities. More project types are part of the
            longer-term plan.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {examples.map((example) => {
              const Icon = example.icon;

              return (
                <article
                  key={example.title}
                  className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6"
                >
                  <Icon
                    className="h-6 w-6 text-blue-400"
                    aria-hidden="true"
                  />

                  <h3 className="mt-4 text-lg font-semibold">
                    {example.title}
                  </h3>

                  <p className="mt-3 flex-1 text-sm leading-7 text-zinc-400">
                    {example.description}
                  </p>

                  <p className="mt-5 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">
                    {example.status}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="mt-16"
          aria-labelledby="process-heading"
        >
          <h2
            id="process-heading"
            className="text-2xl font-bold tracking-tight"
          >
            How it works
          </h2>

          <ol className="mt-6 space-y-4">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-xl border border-zinc-800 p-5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-400">
                  {index + 1}
                </span>

                <div>
                  <h3 className="font-semibold">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-sm leading-7 text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="mt-16 grid gap-5 md:grid-cols-2"
          aria-label="People and payments"
        >
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <Users
              className="h-6 w-6 text-blue-400"
              aria-hidden="true"
            />

            <h2 className="mt-4 text-xl font-semibold">
              Who gets a share?
            </h2>

            <p className="mt-3 leading-7 text-zinc-400">
              That depends on the setup. It might include the
              original artist, a collaborator, the product
              creator, or eligible people who fund an operation.
            </p>

            <p className="mt-3 leading-7 text-zinc-400">
              You may see these people called stakeholders.
              Their agreed shares and responsibilities should
              be clear before anyone takes part.
            </p>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <Wallet
              className="h-6 w-6 text-emerald-400"
              aria-hidden="true"
            />

            <h2 className="mt-4 text-xl font-semibold">
              How do people get paid?
            </h2>

            <p className="mt-3 leading-7 text-zinc-400">
              A revenue pool holds money set aside for sharing.
              The applicable rules determine who can claim it
              and how much they can receive.
            </p>

            <p className="mt-3 leading-7 text-zinc-400">
              An earnings estimate is not a payment. Money must
              be received, recorded, and available before it
              can be claimed.
            </p>
          </article>
        </section>

        <aside className="mt-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <Info
              className="mt-1 h-5 w-5 shrink-0 text-amber-300"
              aria-hidden="true"
            />

            <div>
              <h2 className="font-semibold text-amber-200">
                Tokenizing is not a promise of profit.
              </h2>

              <p className="mt-3 text-sm leading-7 text-amber-100/80">
                Minting records your submission; it does not register a
                copyright or verify that you own the work. Only submit
                work you own or have permission to use.
              </p>
            </div>
          </div>
        </aside>

        <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-7">
          <h2 className="text-2xl font-bold">
            What would you like to do?
          </h2>

          <p className="mt-3 leading-7 text-zinc-400">
            Tokenize your own work, or explore opportunities
            created by others.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/upload-ip"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Upload &amp; Tokenize My IP
              <ArrowRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/tokenized-funds"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold transition hover:bg-zinc-800"
            >
              Explore Revenue Products
              <ArrowRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}