import { GALAXY_USDC } from '../../../lib/tokenized-funds/galaxy/config';
import { GALAXY_QUALITY } from '../../../lib/tokenized-funds/galaxy-quality/config';

type Props = {
  product: 'enhanced' | 'quality';
};

export default function GalaxyDisclosures({ product }: Props) {
  const quality = product === 'quality';
  const config = quality ? GALAXY_QUALITY : GALAXY_USDC;

  const vault = {
    ...config,
    wrapperSymbol: quality ? GALAXY_QUALITY.wrapperSymbol : 'mwGUSDCe',
    assetAddress: quality
      ? GALAXY_QUALITY.assetAddress
      : '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  };

  const productLabel = quality ? 'Quality' : 'Enhanced';

  const riskItems = [
    {
      title: 'Capital and variable returns',
      text:
        `You may lose some or all deposited assets. Yield is variable, ` +
        `historical performance does not predict future returns, and ` +
        `“${productLabel}” is a product name—not a guarantee of safety or returns.`,
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
        'Borrowed liquidity, allocation constraints, contract restrictions, ' +
        'and network conditions can delay or prevent a withdrawal.',
    },
    {
      title: 'Contracts, tokens, and infrastructure',
      text:
        `The Tokenizer, underlying vault, adapters, lending markets, wallet, ` +
        `${vault.network} network, and external services introduce technical risks. ` +
        'USDC can lose its peg; collateral tokens can introduce issuer, ' +
        'custodian, operational, or bridge dependencies.',
    },
    {
      title: 'Wallet approvals and transaction execution',
      text:
        'Review the network, contract, spender, amount, and gas allowance ' +
        'before signing. Approval and deposit are separate actions. ' +
        'Transactions are generally irreversible, failed transactions can ' +
        'still incur network fees, and previews do not guarantee execution results.',
    },
  ];

  const card =
    'rounded-3xl border border-white/[0.08] bg-white/[0.025]';

  return (
    <>
      <section className={`${card} p-6 sm:p-7`}>
        <h2 className="text-lg font-semibold text-slate-100">
          Risks, fees & responsibilities
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          MetaWork’s Tokenizer provides tokenized access to {vault.name}
          {' '}on {vault.network}. The Tokenizer and underlying vault are
          separate contracts with separate permissions and fee settings.
          Galaxy curates the underlying strategy; MetaWork provides the
          Tokenizer and the deposit, position-tracking, and redemption interface.
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
            MetaWork Tokenizer fees & administrator powers
          </summary>

          <div className="mt-3 space-y-3 text-xs leading-6 text-slate-400">
            <p>
              The configured MetaWork performance fee is{' '}
              {vault.performanceFeeBps / 100}% of yield, with a{' '}
              {vault.managementFeeBps / 100}% management fee.
              Underlying vault fees, network fees, and other execution
              costs are separate.
            </p>

            {quality ? (
              <p>
                In the deployment snapshot checked during setup, Tokenizer
                fee rates and recipients remained mutable, with zero
                timelocks for the checked fee-setting functions. The
                administrator and fee recipient were the same wallet.
                These are deployment observations, not continuously
                refreshed permission checks.
              </p>
            ) : (
              <>
                <p>
                  The recorded deployment verification found nine
                  administrator timelocks ranging from one to three days.
                  Selected administrator powers remain available; not every
                  administrative action is delayed. The owner, curator,
                  allocator, sentinel, and performance-fee recipient
                  were the same wallet.
                </p>
                <p>
                  The adapter list was fixed through abdication of its
                  add and remove functions. The adapter-registry setter
                  was retained without an installed delay. These are
                  recorded deployment observations, not continuously
                  refreshed permission checks.
                </p>
              </>
            )}

            <p>
              The Tokenizer and underlying vault have separate governance.
              Open gates today do not establish that every underlying
              permission is permanently fixed. Changes to underlying gates,
              allocations, caps, or other configuration may affect deposits
              or exits.
            </p>
          </div>
        </details>

        <details className="mt-5 border-t border-white/[0.06] pt-5">
          <summary className="cursor-pointer text-sm font-medium text-slate-200">
            Galaxy Curation disclosures & applicable terms
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
              This page does not reproduce the complete agreements.
            </p>
          </div>
        </details>

        <p className="mt-6 rounded-xl bg-amber-400/5 p-4 text-xs leading-6 text-amber-200/80">
          Not an insured savings account. No guaranteed return or
          guaranteed withdrawal timing. This summary is informational
          and is not a substitute for reviewing the contracts and
          applicable terms.
        </p>
      </section>

      <section className={`${card} divide-y divide-white/[0.06] px-6 sm:px-7`}>
        <details className="py-5">
          <summary className="cursor-pointer text-sm font-medium">
            Position tokens & redemption
          </summary>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            Your {vault.wrapperSymbol} position tokens represent your
            proportional interest in the MetaWork Tokenizer. The position
            panel shows your token balance and its estimated USDC asset
            value. That value is not a guaranteed withdrawal quote and
            does not represent a fixed USDC amount per token.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Position tokens provide access to the underlying vault
            through the Tokenizer. They do not represent direct ownership
            of borrower collateral or a guarantee from MetaWork, Galaxy,
            or Morpho.
          </p>
        </details>

        <details className="py-5">
          <summary className="cursor-pointer text-sm font-medium">
            Withdrawals & liquidity
          </summary>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            USDC withdrawals depend on available underlying liquidity
            and contract configuration. Instant withdrawal is not
            guaranteed. The withdrawal panel supports redemption of all
            position tokens held by your connected wallet.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Special exit routes, including forced deallocation and
            in-kind redemption, are not available through this interface.
            Those routes have separate mechanics and may involve
            penalties or additional restrictions.
          </p>
        </details>

        <details className="py-5">
          <summary className="cursor-pointer text-sm font-medium">
            {vault.network} network & deposit asset
          </summary>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            This product is on {quality ? 'Base, not Ethereum mainnet' : 'Ethereum mainnet, not Base'}.
            {' '}Wallet transactions must use chain ID {vault.chainId}.
            The deposit asset is USDC at the address below. Keep ETH
            available on {vault.network} for approval, deposit, and
            redemption gas fees.
          </p>

          <p className="mt-3 break-all font-mono text-xs leading-6 text-slate-300">
            {vault.assetAddress}
          </p>

          <p className="mt-3 text-sm leading-7 text-slate-400">
            Use the connected-wallet controls to deposit. Do not send
            tokens directly to displayed contract addresses. Approval
            alone does not create a position.
          </p>
        </details>

        <details className="py-5">
          <summary className="cursor-pointer text-sm font-medium">
            Infrastructure & product information
          </summary>

          <dl className="mt-4 space-y-4 text-sm">
            {[
              ['Product category', 'MetaWork Earn'],
              ['Underlying strategy', vault.name],
              ['Strategy curator', 'Galaxy'],
              ['Access tool', 'MetaWork Tokenizer'],
              ['Infrastructure', `Morpho Vault V2 · ${vault.network}`],
              ['Underlying vault', vault.underlyingVault],
              ['MetaWork Tokenizer contract', vault.wrapperAddress ?? 'Not configured'],
              ['Position token symbol', vault.wrapperSymbol],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="mt-1 break-all leading-6 text-slate-300">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs leading-6 text-slate-500">
            MetaWork Earn is the product category. The MetaWork Tokenizer
            is the access tool, using a fee-wrapper vault architecture
            over the underlying {vault.name} vault. “Tokenizer” does not
            mean MetaWork originates Galaxy’s strategy or directly
            tokenizes borrower collateral.
          </p>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            Review applicable terms, administrator permissions, fees,
            and withdrawal limitations before depositing. This page is
            a product summary, not a complete agreement or an exhaustive
            permission inventory.
          </p>
        </details>
      </section>
    </>
  );
}
