import { GALAXY_QUALITY } from '../../../lib/tokenized-funds/galaxy-quality/config';

const GALAXY_TERMS =
  'https://docs.curation.galaxy.com/legal/terms-of-use';

const riskItems = [
  {
    title: 'Capital and variable returns',
    text:
      'You may lose some or all deposited assets. Yield is variable, ' +
      'historical performance does not predict future returns, and ' +
      '“Quality” is a product name—not a guarantee of safety.',
  },
  {
    title: 'Collateral, concentration, and pricing',
    text:
      'Collateral-backed lending can incur losses from price declines, ' +
      'oracle failures, unsuccessful liquidations, and bad debt. ' +
      'Exposure may be concentrated in a single market or collateral asset.',
  },
  {
    title: 'Withdrawals and liquidity',
    text:
      'Position value is not a guaranteed immediately withdrawable amount. ' +
      'Borrowed liquidity, allocation constraints, and network conditions ' +
      'can delay or prevent a withdrawal.',
  },
  {
    title: 'Contracts, tokens, and infrastructure',
    text:
      'The wrapper, underlying vault, adapters, lending markets, wallet, ' +
      'Base network, and external services introduce technical risks. ' +
      'USDC can lose its peg; wrapped collateral can introduce issuer, ' +
      'custodian, or bridge dependencies.',
  },
  {
    title: 'Wallet approvals and transaction execution',
    text:
      'Review the network, contract, spender, amount, and gas allowance ' +
      'before signing. Transactions are generally irreversible, and ' +
      'failed transactions can still incur network fees.',
  },
];

export default function QualityDisclosures() {
  const vault = GALAXY_QUALITY;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
      <h2 className="text-lg font-semibold text-slate-100">
        Risks, fees & responsibilities
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        MetaWork’s Tokenizer provides tokenized access to Galaxy USDC
        Quality on Base. The Tokenizer and underlying vault are separate
        contracts with separate permissions and fee settings. Galaxy
        curates the underlying strategy; MetaWork provides the Tokenizer
        and the deposit, position-tracking, and redemption interface.
    	</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {riskItems.map(({ title, text }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"
          >
            <h3 className="text-sm font-medium text-slate-200">
              {title}
            </h3>
            <p className="mt-2 text-xs leading-6 text-slate-400">
              {text}
            </p>
          </div>
        ))}
      </div>

      <details className="mt-6 border-t border-white/[0.06] pt-5">
        <summary className="cursor-pointer text-sm font-medium text-slate-200">
          MetaWork wrapper fees & administrator powers
        </summary>

        <div className="mt-3 space-y-3 text-xs leading-6 text-slate-400">
          <p>
            The configured MetaWork performance fee is{' '}
            {vault.performanceFeeBps / 100}% of yield, with a{' '}
            {vault.managementFeeBps / 100}% management fee. Underlying
            vault fees, network fees, and other execution costs are
            separate.
          </p>

          <p>
            In the deployment snapshot checked during setup, wrapper
            fee rates and recipients remained mutable, with zero
            timelocks for the checked fee-setting functions. The
            administrator and fee recipient were the same wallet.
            These are deployment observations, not continuously
            refreshed permission checks.
          </p>

          <a
            href={`https://basescan.org/address/${vault.wrapperAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sky-300 underline underline-offset-4"
          >
            Inspect the MetaWork wrapper on BaseScan
          </a>
        </div>
      </details>

      <details className="mt-5 border-t border-white/[0.06] pt-5">
        <summary className="cursor-pointer text-sm font-medium text-slate-200">
          Galaxy Curation disclosures & official terms
        </summary>

        <div className="mt-3 space-y-3 text-xs leading-6 text-slate-400">
          <p>
            Galaxy’s published terms describe its role as publishing
            vault strategies and configuration parameters. Galaxy
            disclaims guarantees of performance, security, availability,
            and withdrawal timing, and describes its services as
            non-custodial and not personalized investment advice.
          </p>

          <p>
            Galaxy’s terms include eligibility requirements, risk
            acknowledgments, limitations of liability, and a binding
            arbitration agreement and class-action waiver, subject to
            the terms and exceptions in that document.
          </p>

          <p>
            This is a summary of Galaxy’s terms, not a replacement
            for them or a statement that their protections apply to
            MetaWork. MetaWork’s own applicable terms are separate.
          </p>

          <a
            href={GALAXY_TERMS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sky-300 underline underline-offset-4"
          >
            Read Galaxy Curation’s official Terms of Use ↗
          </a>
        </div>
      </details>

      <p className="mt-6 rounded-xl bg-amber-400/5 p-4 text-xs leading-6 text-amber-200/80">
        Not an insured savings account. No guaranteed return or
        guaranteed withdrawal timing. This summary is informational
        and is not a substitute for reviewing the contracts and
        applicable terms.
      </p>
    </section>
  );
}