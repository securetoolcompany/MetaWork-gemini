import GalaxyDisclosures from '../galaxy/GalaxyDisclosures';

type Props = {
  assetSymbol: string;
  wrapperSymbol: string;
};

export default function ArcDisclosures({
  assetSymbol,
  wrapperSymbol,
}: Props) {
  if (assetSymbol === 'USDC' && wrapperSymbol === 'mwGUSDCa') {
    return <GalaxyDisclosures product="arc-usdc" />;
  }

  if (assetSymbol === 'EURC' && wrapperSymbol === 'mwGEURCa') {
    return <GalaxyDisclosures product="arc-eurc" />;
  }

  throw new Error('Unsupported Arc disclosure configuration.');
}
