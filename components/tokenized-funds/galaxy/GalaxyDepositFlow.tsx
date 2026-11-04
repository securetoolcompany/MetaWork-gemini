type GalaxyDepositFlowProps = {
  assetSymbol: 'USDC' | 'EURC';
};

export default function GalaxyDepositFlow({ assetSymbol }: GalaxyDepositFlowProps) {
  return (
    <section className="mb-5 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
      <h2 className="text-sm font-semibold text-sky-200">
        Where does your money go?
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        When you complete a deposit, your {assetSymbol} leaves your wallet
        and is routed through the MetaWork Tokenizer and its adapter into
        the selected Galaxy vault. Your deposited capital does not remain
        in your wallet.
      </p>
      <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-xs leading-5 text-sky-200">
        Your wallet &rarr; MetaWork Tokenizer &amp; adapter &rarr; Galaxy vault
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Connecting your wallet alone does not move funds. A token approval
        permits spending; it is not a deposit. Funds move when you confirm
        the deposit transaction and it succeeds.
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        Position tokens are held in your wallet to represent your investment
        through the Tokenizer, rather than the original deposited {assetSymbol}.
        Redemptions depend on available liquidity. Capital is at risk.
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        Use the deposit controls when deposits are enabled. Do not send
        tokens directly to contract addresses.
      </p>
    </section>
  );
}
