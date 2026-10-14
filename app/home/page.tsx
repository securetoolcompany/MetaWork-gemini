'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowRight,
  Terminal,
  Network,
  PackageSearch,
  Activity,
  ShieldCheck,
  Cpu,
  ArrowLeftRight,
  Layers,
  Store,
  BarChart3,
  Globe,
  Crosshair,
  Zap,
  Lock,
  LineChart,
  Database,
  Palette,
  ShoppingBag,
  Building2,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import CreatorCard from '@/components/showroom/CreatorCard';
import AisleProductCard from '@/components/aisle-public/AisleProductCard';
import AisleIPAssetCard from '@/components/aisle-public/AisleIPAssetCard';

type ShowroomItem = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  creatorName?: string;
  ownerName?: string;
  creatorHandle?: string;
  coverImage?: string;
  image?: string;
  products?: any[];
};

type ShowroomProduct = {
  _id?: string;
	id?: string;
	name?: string;
  title?: string;
  image?: string;
  imageUrl?: string;
  thumbnail?: string;
  price?: number | string;
  ipName?: string;
  ipTitle?: string;
  aisleId?: string;
  aisle?: string;
};

const audiencePaths = [
  {
    id: 'creators',
    icon: Palette,
    title: 'For Creators',
    description:
      'Turn your art, designs, and ideas into real products—without inventory or fulfillment headaches.',
    cta: 'Create & Sell',
    href: '/login',
    accent: 'purple'
  },
  {
    id: 'shoppers',
    icon: ShoppingBag,
    title: 'For Shoppers',
    description:
      'Discover original products from independent creators and support the people behind the designs.',
    cta: 'Shop Now',
    href: '/showroom',
    accent: 'blue'
  },
  {
    id: 'businesses',
    icon: Building2,
    title: 'For Businesses & Projects',
    description:
      'Tokenize IP, future revenue, or real-world projects—and automate how value is shared.',
    cta: 'Tokenize a Project',
    href: '/login',
    accent: 'indigo'
  },
  {
    id: 'investors',
    icon: TrendingUp,
    title: 'For Investors',
    description:
      'Explore tokenized revenue streams from infrastructure, digital assets, agriculture, and creator businesses.',
    cta: 'Explore Revenue Pools',
    href: '/showroom',
    accent: 'emerald'
  }
];

const accentStyles: Record<
  string,
  { icon: string; border: string; button: string }
> = {
  blue: {
    icon: 'text-blue-400',
    border: 'hover:border-blue-500/50',
    button:
      'border-blue-500/40 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200'
  },
  purple: {
    icon: 'text-purple-400',
    border: 'hover:border-purple-500/50',
    button:
      'border-purple-500/40 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200'
  },
  indigo: {
    icon: 'text-indigo-400',
    border: 'hover:border-indigo-500/50',
    button:
      'border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200'
  },
  emerald: {
    icon: 'text-emerald-400',
    border: 'hover:border-emerald-500/50',
    button:
      'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200'
  }
};

function shuffleItems<T>(items: T[]): T[] {
  const copied = [...items];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

export default function WelcomePage() {
  const [showroomData, setShowroomData] = useState<{
		aisles: ShowroomItem[];
		products: ShowroomProduct[];
		ipAssets: any[];
	}>({ aisles: [], products: [], ipAssets: [] });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadShowroom = async () => {
      try {
        const response = await fetch('/api/showroom');
        const raw = await response.json();

        const aisles = Array.isArray(raw)
          ? raw.filter((item: any) => item.type === 'aisle')
          : Array.isArray(raw?.aisles)
            ? raw.aisles
            : [];

        const products = Array.isArray(raw)
          ? raw.filter((item: any) => item.type === 'product')
          : Array.isArray(raw?.products)
            ? raw.products
            : [];

				const ipAssets = Array.isArray(raw)
					? raw.filter((item: any) => item.type === 'ip')
					: Array.isArray(raw?.ipAssets)
						? raw.ipAssets
						: [];

				if (mounted) {
					setShowroomData({ aisles, products, ipAssets });
				}

        if (mounted) {
					setShowroomData({ aisles, products, ipAssets });
				}
      } catch (error) {
        console.error('Homepage showroom fetch failed:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadShowroom();

    return () => {
      mounted = false;
    };
  }, []);

  const featuredAisles = useMemo(
		() => shuffleItems(showroomData.aisles).slice(0, 4),
		[showroomData.aisles]
	);

	const featuredProducts = useMemo(
		() => shuffleItems(showroomData.products).slice(0, 4),
		[showroomData.products]
	);

	const featuredIP = useMemo(
		() => shuffleItems(showroomData.ipAssets).slice(0, 4),
		[showroomData.ipAssets]
	);

  const getAisleProduct = (aisle: ShowroomItem): ShowroomProduct | null => {
    const aisleId = aisle._id || aisle.id;

    const linkedProduct = showroomData.products.find(
      (product) =>
        product.aisleId === aisleId ||
        product.aisle === aisle.name ||
        product.aisle === aisle.title
    );

    if (linkedProduct) {
      return linkedProduct;
    }

    return aisle.products?.[0] || null;
  };

  const getProductImage = (product: ShowroomProduct | null) => {
    return (
      product?.image ||
      product?.imageUrl ||
      product?.thumbnail ||
      ''
    );
  };

  const formatPrice = (price: number | string) => {
    if (typeof price === 'number') {
      return `$${price.toFixed(2)}`;
    }

    return price.startsWith('$') ? price : `$${price}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30">
      {/* HERO */}
      <section className="relative px-8 pt-24 pb-16 max-w-7xl mx-auto w-full border-b border-zinc-800/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-left space-y-8">
            <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs font-mono text-zinc-400 uppercase tracking-widest">
              <Terminal className="mr-2 h-3.5 w-3.5 text-blue-400" />
              MetaWork OS v2.0
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1]">
              Home to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Tokenized Markets.
              </span>
            </h1>

            <p className="text-xl text-zinc-400 leading-relaxed max-w-xl font-light">
              Create products from your ideas. Buy from independent creators.
              Tokenize real-world projects. Invest in the revenue they generate.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/login">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-none border border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                >
                  Start Creating
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>

              <Link href="/showroom">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg w-full sm:w-auto border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-none"
                >
                  Shop the Marketplace
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-2 px-3 pb-2 mb-2 border-b border-zinc-800">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
              <span className="ml-2 text-xs font-mono text-zinc-500">
                metawork-marketplace-view
              </span>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-950 flex items-center justify-center border border-zinc-800/50">
              <img
                src="https://res.cloudinary.com/dplnacuyy/image/upload/v1775738117/Operations_ndfrqb.png"
                alt="MetaWork marketplace and creator dashboard"
                className="object-cover w-full h-full opacity-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE ROUTER */}
      <section className="px-8 py-20 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              What do you want to do?
            </h2>
            <p className="text-lg text-zinc-400">
              MetaWork brings creators, shoppers, project sponsors, and investors
              into one tokenized economy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {audiencePaths.map((path) => {
              const accent = accentStyles[path.accent];
              const Icon = path.icon;

              return (
                <Card
                  key={path.id}
                  className={`bg-zinc-900/40 border-zinc-800 rounded-none flex flex-col transition-colors ${accent.border}`}
                >
                  <CardHeader className="pb-4">
                    <Icon className={`h-8 w-8 mb-4 ${accent.icon}`} />
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      {path.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col justify-between">
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                      {path.description}
                    </p>

                    <Link href={path.href}>
                      <Button
                        variant="outline"
                        className={`w-full rounded-none font-medium ${accent.button}`}
                      >
                        {path.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CREATORS */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-purple-300 mb-6">
              For Creators
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Your ideas. Real products. Automatic royalties.
            </h2>

            <p className="text-lg text-zinc-400 leading-relaxed mb-8">
              Upload your artwork, logo, pattern, or design. Turn it into apparel,
              merch, and custom products. When it sells, MetaWork handles
              fulfillment and routes your earnings automatically.
            </p>

            <div className="space-y-4 mb-10">
              {[
                'Upload your IP',
                'Design custom merchandise',
                'Publish it to your Aisle',
                'Earn automatically when it sells'
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-mono text-purple-300">
                    {index + 1}
                  </div>
                  <span className="text-zinc-300">{step}</span>
                </div>
              ))}
            </div>

            <Link href="/login">
              <Button
                size="lg"
                className="h-12 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-none border border-purple-500"
              >
                Start Creating
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <PackageSearch className="h-6 w-6 text-purple-400" />
              <h3 className="text-xl font-semibold">Your Aisle</h3>
            </div>

            <p className="text-zinc-400 mb-8">
              An Aisle is your creator storefront. Publish products built from
              your IP, curate your collection, and give shoppers one place to
              find and buy your work.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-zinc-800 bg-zinc-950 p-4">
                <Layers className="h-5 w-5 text-purple-400 mb-3" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Design Tools
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Add artwork, text, and shapes to product mockups.
                </p>
              </div>

              <div className="border border-zinc-800 bg-zinc-950 p-4">
                <Store className="h-5 w-5 text-purple-400 mb-3" />
                <h4 className="text-sm font-semibold text-zinc-200">
                  Creator Storefront
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Publish products and build your own public Aisle.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

			{/* SHOPPERS + FEATURED AISLES */}
			<section className="px-8 py-24 bg-zinc-900/30 border-b border-zinc-800/50">
				<div className="max-w-7xl mx-auto">
					<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14">
						<div className="max-w-2xl">
							<div className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-blue-300 mb-6">
								For Shoppers
							</div>

							<h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
								Shop directly from your favorite creator’s Aisle.
							</h2>

							<p className="text-lg text-zinc-400 leading-relaxed">
								An Aisle is a creator’s storefront. Creators publish products built
								from their own IP, shoppers discover and buy them, and creators earn
								automatically when sales happen.
							</p>
						</div>

						<Link href="/showroom">
							<Button
								size="lg"
								className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-none border border-blue-500"
							>
								Browse All Aisles
								<ArrowRight className="ml-2 h-5 w-5" />
							</Button>
						</Link>
					</div>

					{loading ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
							{[0, 1, 2].map((index) => (
								<div
									key={index}
									className="h-80 animate-pulse rounded-2xl border border-white/10 bg-slate-900/40"
								/>
							))}
						</div>
					) : featuredAisles.length === 0 ? (
						<div className="h-64 flex flex-col items-center justify-center text-center bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
							<div className="text-4xl mb-4 opacity-50">🏪</div>
							<h3 className="text-lg font-medium text-white">
								Creator Aisles are coming online
							</h3>
							<p className="text-slate-500 text-sm mt-2 max-w-sm">
								Be among the first creators to publish products and open your Aisle.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
							{featuredAisles.map((aisle) => (
								<CreatorCard
									key={aisle.id || aisle._id}
									creator={aisle}
								/>
							))}
						</div>
					)}

					<div className="mt-14 grid md:grid-cols-3 gap-6 border border-zinc-800 bg-zinc-950/60 p-8">
						<div>
							<Palette className="h-6 w-6 text-purple-400 mb-3" />
							<h3 className="text-lg font-semibold text-zinc-100 mb-2">
								Creators publish
							</h3>
							<p className="text-sm text-zinc-400">
								Upload IP, design products, and publish them to your own Aisle.
							</p>
						</div>

						<div>
							<ShoppingBag className="h-6 w-6 text-blue-400 mb-3" />
							<h3 className="text-lg font-semibold text-zinc-100 mb-2">
								Shoppers buy
							</h3>
							<p className="text-sm text-zinc-400">
								Discover creators, browse their Aisles, and purchase original products.
							</p>
						</div>

						<div>
							<TrendingUp className="h-6 w-6 text-emerald-400 mb-3" />
							<h3 className="text-lg font-semibold text-zinc-100 mb-2">
								Everyone earns
							</h3>
							<p className="text-sm text-zinc-400">
								Creators earn from product sales today—and can share in Aisle traffic
								revenue as the network grows.
							</p>
						</div>
					</div>
				</div>
			</section>
			{/* FEATURED PRODUCTS */}
			<section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
				<div className="max-w-7xl mx-auto">
					<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
						<div className="max-w-2xl">
							<div className="inline-flex items-center rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-purple-300 mb-6">
								Featured Products
							</div>

							<h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
								Products built from creator IP.
							</h2>

							<p className="text-lg text-zinc-400">
								Shop original merchandise created by independent creators and powered
								by tokenized intellectual property.
							</p>
						</div>

						<Link href="/showroom">
							<Button
								size="lg"
								variant="outline"
								className="h-12 px-8 rounded-none border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
							>
								Browse All Products
								<ArrowRight className="ml-2 h-5 w-5" />
							</Button>
						</Link>
					</div>

					{loading ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
							{[0, 1, 2, 3].map((index) => (
								<div
									key={index}
									className="h-80 animate-pulse rounded-2xl border border-white/10 bg-slate-900/40"
								/>
							))}
						</div>
					) : featuredProducts.length === 0 ? (
						<div className="h-64 flex flex-col items-center justify-center text-center bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
							<PackageSearch className="h-10 w-10 text-zinc-700 mb-4" />
							<h3 className="text-lg font-medium text-white">
								Products are coming online
							</h3>
							<p className="text-slate-500 text-sm mt-2 max-w-sm">
								Creators are publishing new merchandise built from tokenized IP.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
							{featuredProducts.map((product) => (
								<AisleProductCard
									key={product.id || product._id}
									product={product}
									item={product}
								/>
							))}
						</div>
					)}
				</div>
			</section>

			{/* FEATURED IP */}
			<section className="px-8 py-24 bg-zinc-900/30 border-b border-zinc-800/50">
				<div className="max-w-7xl mx-auto">
					<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
						<div className="max-w-2xl">
							<div className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-blue-300 mb-6">
								Tokenized IP
							</div>

							<h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
								Discover the IP behind the products.
							</h2>

							<p className="text-lg text-zinc-400">
								Explore original artwork, logos, patterns, photography, and designs.
								Creators can license their IP into products while retaining ownership
								and earning from its use.
							</p>
						</div>

						<Link href="/showroom">
							<Button
								size="lg"
								variant="outline"
								className="h-12 px-8 rounded-none border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
							>
								Browse IP Assets
								<ArrowRight className="ml-2 h-5 w-5" />
							</Button>
						</Link>
					</div>

					{loading ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
							{[0, 1, 2, 3].map((index) => (
								<div
									key={index}
									className="h-80 animate-pulse rounded-2xl border border-white/10 bg-slate-900/40"
								/>
							))}
						</div>
					) : featuredIP.length === 0 ? (
						<div className="h-64 flex flex-col items-center justify-center text-center bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
							<Palette className="h-10 w-10 text-zinc-700 mb-4" />
							<h3 className="text-lg font-medium text-white">
								IP assets are coming online
							</h3>
							<p className="text-slate-500 text-sm mt-2 max-w-sm">
								Upload your artwork, designs, and creative assets to begin building
								tokenized products.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
							{featuredIP.map((item) => (
								<AisleIPAssetCard
									key={item.id || item._id}
									item={item}
									ipAsset={item}
									accentColor="#3b82f6"
								/>
							))}
						</div>
					)}
				</div>
			</section>

      {/* BUSINESSES & PROJECTS */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <div className="inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-indigo-300 mb-6">
              For Businesses & Projects
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Tokenize real-world value.
            </h2>

            <p className="text-lg text-zinc-400 leading-relaxed">
              Turn intellectual property, future revenue, or real-world projects
              into tokenized markets. Define stakeholders, raise participation,
              route revenue automatically, and give supporters a transparent way
              to participate.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader>
                <Network className="h-7 w-7 text-indigo-400 mb-3" />
                <CardTitle className="text-lg">Tokenize Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Convert IP, project revenue, infrastructure, or real-world
                  assets into digital tokens on Algorand.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader>
                <ShieldCheck className="h-7 w-7 text-indigo-400 mb-3" />
                <CardTitle className="text-lg">
                  Structure Stakeholders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Define owners, operators, contributors, and platform allocations
                  with transparent on-chain entitlements.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader>
                <Activity className="h-7 w-7 text-indigo-400 mb-3" />
                <CardTitle className="text-lg">Automate Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Send project revenue to a Revenue Pool and let token holders
                  claim their share automatically.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10">
            <Link href="/login">
              <Button
                size="lg"
                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-none border border-indigo-500"
              >
                Tokenize a Project
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* INVESTORS */}
      <section className="px-8 py-24 bg-zinc-900/30 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-emerald-300 mb-6">
              For Investors
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Own a share of real-world revenue.
            </h2>

            <p className="text-lg text-zinc-400 leading-relaxed mb-8">
              Explore tokenized revenue streams from community infrastructure,
              blockchain nodes, agriculture, creator businesses, and other
              cash-flowing projects. Review performance and claim distributions
              from Revenue Pools.
            </p>

            <Link href="/showroom">
              <Button
                size="lg"
                className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border border-emerald-500"
              >
                Explore Revenue Pools
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
            <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
              <span className="ml-2 text-xs font-mono text-zinc-500">
                revenue_pool_terminal
              </span>
            </div>

            <div className="p-6 font-mono text-xs text-zinc-400 space-y-3">
              <div className="text-zinc-600">LIVE_FEED &gt; REVENUE_POOLS</div>

              <div className="flex justify-between">
                <span>COMMUNITY_FIBER_01</span>
                <span className="text-emerald-400">DISTRIBUTION READY</span>
              </div>

              <div className="flex justify-between">
                <span>NODE_INFRA_POOL</span>
                <span className="text-blue-400">REVENUE DEPOSITED</span>
              </div>

              <div className="flex justify-between">
                <span>CREATOR_IP_ROYALTIES</span>
                <span className="text-purple-400">AUTO-SPLIT ACTIVE</span>
              </div>

              <div className="pt-4 border-t border-zinc-800 text-zinc-500">
                Revenue distributions are project-specific and subject to each
                project’s terms, performance, and disclosures.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM CAPABILITIES */}
      <section className="px-8 py-24 bg-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              One platform. Four ways to participate.
            </h2>
            <p className="text-lg text-zinc-400">
              MetaWork connects creation, commerce, tokenization, and investment
              in a single operating system.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader>
                <Palette className="h-7 w-7 text-purple-400 mb-3" />
                <CardTitle className="text-lg">Create</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Upload IP, design products, and publish them to a creator Aisle.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader>
                <ShoppingBag className="h-7 w-7 text-blue-400 mb-3" />
                <CardTitle className="text-lg">Buy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Shop original products and support independent creators.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader>
                <Building2 className="h-7 w-7 text-indigo-400 mb-3" />
                <CardTitle className="text-lg">Tokenize</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Turn IP, projects, and revenue streams into tokenized markets.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-zinc-800 rounded-none">
              <CardHeader>
                <TrendingUp className="h-7 w-7 text-emerald-400 mb-3" />
                <CardTitle className="text-lg">Earn</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400">
                  Claim royalties, revenue distributions, and project earnings.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* TECHNICAL PROOF */}
      <section className="px-8 py-24 bg-zinc-900/30 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
                <span className="ml-2 text-xs font-mono text-zinc-500">
                  system_kernel_log
                </span>
              </div>

              <div className="p-5 font-mono text-[10px] sm:text-xs text-emerald-500/70 space-y-2 h-48 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950 z-10" />
                <p>&gt; initializing routing protocol...</p>
                <p>
                  &gt; connecting to algorand mainnet...{' '}
                  <span className="text-zinc-300">[OK]</span>
                </p>
                <p>&gt; loading smart contract ABIs...</p>
                <p>&gt; validating revenue pool signatures...</p>
                <p>&gt; deploying dynamic royalty split module...</p>
                <p className="text-blue-400">
                  &gt; marketplace and creator aisles online.
                </p>
                <p className="animate-pulse">&gt; _</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-md text-center">
                <Database className="h-6 w-6 text-indigo-400 mb-2" />
                <span className="block font-mono text-xs text-zinc-300">
                  Distributed Storage
                </span>
                <span className="text-[10px] text-zinc-500">
                  IP and project records
                </span>
              </div>

              <div className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-md text-center">
                <Network className="h-6 w-6 text-blue-400 mb-2" />
                <span className="block font-mono text-xs text-zinc-300">
                  Algorand Consensus
                </span>
                <span className="text-[10px] text-zinc-500">
                  Transparent settlement
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-3xl font-bold tracking-tight mb-8">
              Built for transparent value creation.
            </h3>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Layers className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-zinc-200 mb-1">
                    Unified Asset Management
                  </h4>
                  <p className="text-sm text-zinc-400">
                    Track intellectual property, products, tokens, sales, and
                    revenue distributions from one dashboard.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Store className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-zinc-200 mb-1">
                    Creator Storefronts
                  </h4>
                  <p className="text-sm text-zinc-400">
                    Launch an Aisle, curate products, manage pricing, and put
                    your work in front of shoppers.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ArrowLeftRight className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-zinc-200 mb-1">
                    Automated Revenue Routing
                  </h4>
                  <p className="text-sm text-zinc-400">
                    Smart-contract architecture routes product and project revenue
                    to creators, IP owners, stakeholders, and the platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ADVANTAGE */}
      <section className="px-8 py-24 bg-blue-900/5 border-t border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              The MetaWork Advantage
            </h2>
            <p className="text-zinc-400">
              One connected system for creating, selling, tokenizing, and earning.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="bg-zinc-950 p-10">
              <h3 className="text-xl font-bold text-red-400 mb-8 flex items-center gap-2">
                <LineChart className="h-5 w-5 rotate-180" />
                Fragmented Systems
              </h3>

              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">
                      Separate Tools
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">
                      E-commerce, fulfillment, licensing, payments, and investment
                      tools live in different places.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">
                      Slow Settlement
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">
                      Revenue and royalties often wait on banks, intermediaries,
                      and manual reconciliation.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-xs">✕</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-300">
                      Limited Participation
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1">
                      Supporters can buy products, but rarely participate in the
                      value a project creates.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-zinc-900/80 p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full" />

              <h3 className="text-xl font-bold text-blue-400 mb-8 flex items-center gap-2 relative z-10">
                <Zap className="h-5 w-5" />
                MetaWork
              </h3>

              <ul className="space-y-6 relative z-10">
                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Connected Commerce
                    </h4>
                    <p className="text-xs text-blue-200/70 mt-1">
                      Create products, manage storefronts, and route revenue in
                      one place.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Tokenized Participation
                    </h4>
                    <p className="text-xs text-blue-200/70 mt-1">
                      Turn projects and revenue streams into transparent, ownable
                      digital markets.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-400 text-xs">✓</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Automated Distribution
                    </h4>
                    <p className="text-xs text-blue-200/70 mt-1">
                      Use Revenue Pools and smart contracts to route value to the
                      right stakeholders.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 border-t border-zinc-800 bg-zinc-950 text-center">
        <h2 className="text-3xl font-bold mb-6">
          Create. Shop. Tokenize. Earn.
        </h2>

        <p className="text-zinc-400 mb-10 max-w-xl mx-auto">
          Join creators, shoppers, project sponsors, and investors building the
          next generation of tokenized markets.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/login">
            <Button
              size="lg"
              className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-200 rounded-none font-bold"
            >
              <Lock className="mr-2 h-5 w-5" />
              Create Free Account
            </Button>
          </Link>

          <Link href="/showroom">
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-10 text-lg rounded-none border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Shop the Marketplace
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}