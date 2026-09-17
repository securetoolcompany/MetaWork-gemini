'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileSignature,
  ImagePlus,
  Info,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type CardProgram = 'event' | 'athlete' | 'autograph';
type FrontLayout =
  | 'event-feature'
  | 'traditional'
  | 'full-image'
  | 'first-ink';
type BackLayout =
  | 'event-details'
  | 'athlete-bio'
  | 'tale-of-tape'
  | 'highlights-qr';
type HolographicFinish =
  | 'supplier-recommendation'
  | 'gear'
  | 'lattice'
  | 'flowers'
  | 'windmill'
  | 'line'
  | 'period';

type UploadedAsset = {
  id: string;
  file: File;
  previewUrl: string;
};

type Sponsor = {
  id: string;
  name: string;
  tier: 'featured' | 'primary' | 'supporting' | 'event_partner';
  placement: 'front_footer' | 'front_corner' | 'back_strip' | 'back_grid';
  websiteUrl: string;
};

const STEPS = [
  { id: 1, label: 'Card Type', icon: Trophy },
  { id: 2, label: 'Content', icon: BadgeCheck },
  { id: 3, label: 'Style', icon: Palette },
  { id: 4, label: 'Sponsors', icon: Users },
  { id: 5, label: 'Media', icon: Upload },
  { id: 6, label: 'Review', icon: ShieldCheck },
] as const;

const PROGRAMS: Array<{
  id: CardProgram;
  title: string;
  eyebrow: string;
  description: string;
  image: string;
  imageAlt: string;
  icon: typeof CalendarDays;
}> = [
  {
    id: 'event',
    title: 'Event Card',
    eyebrow: 'Fight nights, tournaments & special events',
    description:
      'Create a collectible tied to a named event, matchup, promotion, venue, or limited event series.',
    image: '/athlete-cards/nate-tc-mock-front.jpeg',
    imageAlt: 'Nathaniel Gastelum event-card example',
    icon: CalendarDays,
  },
  {
    id: 'athlete',
    title: 'Athlete Card',
    eyebrow: 'Traditional player-card collectible',
    description:
      'Build a year-round card centered on the athlete, their team, their story, and their accomplishments.',
    image: '/athlete-cards/nate-tc-mock-back.jpeg',
    imageAlt: 'Nathaniel Gastelum athlete-card back example',
    icon: Trophy,
  },
  {
    id: 'autograph',
    title: 'First Ink / Autograph',
    eyebrow: 'Collector and signing editions',
    description:
      'Create a premium card with an autograph panel, hand-signed run option, or printed signature treatment.',
    image: '/athlete-cards/first-ink-template-card-sample.jpeg',
    imageAlt: 'First Ink autograph card template',
    icon: FileSignature,
  },
];

const FRONT_LAYOUTS: Array<{
  id: FrontLayout;
  title: string;
  description: string;
  programs: CardProgram[];
}> = [
  {
    id: 'event-feature',
    title: 'Event Feature',
    description: 'Event branding, athlete image, matchup, date, and venue.',
    programs: ['event'],
  },
  {
    id: 'traditional',
    title: 'Traditional Athlete',
    description: 'Portrait, athlete name, team or gym, number, and sport details.',
    programs: ['athlete', 'autograph'],
  },
  {
    id: 'full-image',
    title: 'Full Image / Action',
    description: 'A full-bleed action image with strong athlete or event identity.',
    programs: ['event', 'athlete', 'autograph'],
  },
  {
    id: 'first-ink',
    title: 'First Ink Panel',
    description: 'Collector-focused front with an open autograph area.',
    programs: ['autograph'],
  },
];

const BACK_LAYOUTS: Array<{
  id: BackLayout;
  title: string;
  description: string;
  programs: CardProgram[];
}> = [
  {
    id: 'event-details',
    title: 'Event Details',
    description: 'Event date, venue, matchup, promotion, partners, and callout.',
    programs: ['event'],
  },
  {
    id: 'athlete-bio',
    title: 'Bio & Stats',
    description: 'Athlete story, team details, accomplishments, and sport-specific stats.',
    programs: ['athlete', 'autograph'],
  },
  {
    id: 'tale-of-tape',
    title: 'Tale of the Tape',
    description: 'Age, height, weight, reach, record, division, gym, and titles.',
    programs: ['event', 'athlete', 'autograph'],
  },
  {
    id: 'highlights-qr',
    title: 'Highlights & QR',
    description: 'Career highlights, social links, recruiting page, or video destination.',
    programs: ['athlete', 'autograph'],
  },
];

const HOLOGRAPHIC_FINISHES: Array<{
  id: HolographicFinish;
  title: string;
  description: string;
  className: string;
}> = [
  {
    id: 'supplier-recommendation',
    title: 'Supplier Recommendation',
    description: 'We match the finish to your design proof.',
    className: 'from-slate-200 via-zinc-500 to-slate-100',
  },
  {
    id: 'gear',
    title: 'Gear',
    description: 'Mechanical circular pattern.',
    className: 'from-amber-500 via-yellow-200 to-orange-600',
  },
  {
    id: 'lattice',
    title: 'Lattice',
    description: 'Cross-grid holographic pattern.',
    className: 'from-cyan-500 via-fuchsia-500 to-blue-700',
  },
  {
    id: 'flowers',
    title: 'Flowers',
    description: 'Decorative reflective pattern.',
    className: 'from-pink-500 via-violet-400 to-sky-400',
  },
  {
    id: 'windmill',
    title: 'Windmill',
    description: 'Radial movement pattern.',
    className: 'from-indigo-500 via-cyan-300 to-fuchsia-500',
  },
  {
    id: 'line',
    title: 'Line',
    description: 'Fine linear holographic effect.',
    className: 'from-emerald-300 via-blue-500 to-violet-600',
  },
  {
    id: 'period',
    title: 'Period',
    description: 'Speckled reflective pattern.',
    className: 'from-yellow-300 via-slate-500 to-blue-300',
  },
];

function makeAssetId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function programLabel(program: CardProgram) {
  if (program === 'event') return 'Event Card';
  if (program === 'autograph') return 'First Ink / Autograph Card';
  return 'Athlete Card';
}

export default function AthleteCardsPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [program, setProgram] = useState<CardProgram>('event');
  const [frontLayout, setFrontLayout] =
    useState<FrontLayout>('event-feature');
  const [backLayout, setBackLayout] =
    useState<BackLayout>('tale-of-tape');
  const [holographicFinish, setHolographicFinish] =
    useState<HolographicFinish>('supplier-recommendation');

  const [form, setForm] = useState({
    athleteName: '',
    displayName: '',
    moniker: '',
    sport: 'MMA / Combat Sports',
    teamOrGym: '',
    positionOrDivision: '',
    jerseyNumber: '',
    hometown: '',
    athleteBio: '',
    eventName: '',
    eventDate: '',
    eventVenue: '',
    eventOrganizer: '',
    matchup: '',
    age: '',
    height: '',
    weight: '',
    reach: '',
    stance: '',
    record: '',
    titles: '',
    achievements: '',
    qrDestination: '',
    primaryColor: '',
    accentColor: '',
    backgroundStyle: 'Energy / lightning',
    specialInstructions: '',
    autographMode: 'blank_panel',
    editionType: 'open',
    editionSize: '',
    cardQuantity: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    rightsConfirmed: false,
    sponsorRightsConfirmed: false,
    guardianConsentConfirmed: false,
  });

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [primaryPhotos, setPrimaryPhotos] = useState<UploadedAsset[]>([]);
  const [additionalPhotos, setAdditionalPhotos] = useState<UploadedAsset[]>([]);
  const [logos, setLogos] = useState<UploadedAsset[]>([]);
  const [sponsorLogos, setSponsorLogos] = useState<UploadedAsset[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<UploadedAsset[]>([]);

  const availableFrontLayouts = useMemo(
    () => FRONT_LAYOUTS.filter((layout) => layout.programs.includes(program)),
    [program],
  );

  const availableBackLayouts = useMemo(
    () => BACK_LAYOUTS.filter((layout) => layout.programs.includes(program)),
    [program],
  );

  const isCombatSport = /mma|boxing|kickboxing|muay thai|wrestling|jiu-jitsu|bjj/i.test(
    form.sport,
  );

  const updateForm = (field: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const chooseProgram = (nextProgram: CardProgram) => {
    setProgram(nextProgram);

    const nextFront = FRONT_LAYOUTS.find((layout) =>
      layout.programs.includes(nextProgram),
    );
    const nextBack = BACK_LAYOUTS.find((layout) =>
      layout.programs.includes(nextProgram),
    );

    if (
      !FRONT_LAYOUTS.find((layout) => layout.id === frontLayout)?.programs.includes(
        nextProgram,
      )
    ) {
      setFrontLayout(nextFront?.id || 'full-image');
    }

    if (
      !BACK_LAYOUTS.find((layout) => layout.id === backLayout)?.programs.includes(
        nextProgram,
      )
    ) {
      setBackLayout(nextBack?.id || 'tale-of-tape');
    }
  };

  const addAssets = (
    event: ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<UploadedAsset[]>>,
    maxCount: number,
  ) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setter((current) => {
      const remaining = Math.max(0, maxCount - current.length);

      return [
        ...current,
        ...files.slice(0, remaining).map((file) => ({
          id: makeAssetId(),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });

    event.target.value = '';
  };

  const removeAsset = (
    assetId: string,
    setter: React.Dispatch<React.SetStateAction<UploadedAsset[]>>,
  ) => {
    setter((current) => {
      const asset = current.find((item) => item.id === assetId);
      if (asset) URL.revokeObjectURL(asset.previewUrl);

      return current.filter((item) => item.id !== assetId);
    });
  };

  const addSponsor = () => {
    if (sponsors.length >= 5) return;

    setSponsors((current) => [
      ...current,
      {
        id: makeAssetId(),
        name: '',
        tier: 'supporting',
        placement: 'back_strip',
        websiteUrl: '',
      },
    ]);
  };

  const updateSponsor = (
    sponsorId: string,
    field: keyof Omit<Sponsor, 'id'>,
    value: string,
  ) => {
    setSponsors((current) =>
      current.map((sponsor) =>
        sponsor.id === sponsorId ? { ...sponsor, [field]: value } : sponsor,
      ),
    );
  };

  const removeSponsor = (sponsorId: string) => {
    setSponsors((current) =>
      current.filter((sponsor) => sponsor.id !== sponsorId),
    );
  };

  const canAdvance = () => {
    if (activeStep === 1) return Boolean(program);

    if (activeStep === 2) {
      if (!form.athleteName.trim() || !form.sport.trim()) return false;
      if (program === 'event' && !form.eventName.trim()) return false;
      return true;
    }

    if (activeStep === 5) return primaryPhotos.length > 0;

    if (activeStep === 6) {
      return (
        Boolean(form.customerName.trim()) &&
        Boolean(form.customerEmail.trim()) &&
        form.rightsConfirmed &&
        form.sponsorRightsConfirmed
      );
    }

    return true;
  };

  const goNext = () => {
    if (!canAdvance()) return;
    setActiveStep((current) => Math.min(6, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setActiveStep((current) => Math.max(1, current - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitDraft = async (event: FormEvent) => {
    event.preventDefault();

    if (!canAdvance()) return;

    setSubmitting(true);

    // Draft-only behavior. Replace this with an authenticated API request later.
    await new Promise((resolve) => setTimeout(resolve, 900));

    setSubmitting(false);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#05070d] px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-2xl">
          <Card className="overflow-hidden border-emerald-400/20 bg-[#0b1020] shadow-2xl">
            <CardContent className="p-8 text-center sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                <Check className="h-8 w-8 text-emerald-300" />
              </div>

              <Badge className="mt-6 border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                REQUEST DRAFT SUBMITTED
              </Badge>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                Your {programLabel(program)} request is ready for review.
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                This local first draft does not send data to production yet. The
                next build step is connecting this form to authenticated request
                storage, Cloudinary uploads, and an internal proof-review queue.
              </p>

              <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Program
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {programLabel(program)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Athlete
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {form.displayName || form.athleteName}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Primary photos
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {primaryPhotos.length}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="bg-blue-600 text-white hover:bg-blue-500"
                  onClick={() => {
                    setSubmitted(false);
                    setActiveStep(1);
                  }}
                >
                  Start Another Card
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Link href="/showroom">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08] sm:w-auto"
                  >
                    Return to Showroom
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070d] text-white selection:bg-amber-400/30">
      <section className="relative overflow-hidden border-b border-amber-300/10 bg-[#080b12]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.16),transparent_34%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.14),transparent_28%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-16">
          <div>
            <Link
              href="/showroom"
              className="inline-flex items-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              Back to Global Showroom
            </Link>

            <div className="mt-7 inline-flex items-center rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              520 Collects × MetaWork
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Build a card people
              <span className="block bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
                want to collect.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Create event cards, traditional athlete cards, and collector-ready
              autograph editions. Configure the card, upload the media, include
              your sponsors, and submit it for proof and production review.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Badge className="border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-amber-100">
                <Trophy className="mr-1.5 h-3.5 w-3.5" />
                Event & athlete editions
              </Badge>
              <Badge className="border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-blue-100">
                <FileSignature className="mr-1.5 h-3.5 w-3.5" />
                Autograph-ready options
              </Badge>
              <Badge className="border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1.5 text-fuchsia-100">
                <CircleDollarSign className="mr-1.5 h-3.5 w-3.5" />
                Sponsor placement
              </Badge>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-8 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/30 bg-black shadow-[0_0_60px_rgba(245,158,11,0.2)]">
              <Image
                src="/athlete-cards/520-collects-how-it-works.jpeg"
                alt="520 Collects custom trading and sports cards process"
                width={1024}
                height={1536}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-30 border-b border-white/10 bg-[#05070d]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <div className="flex min-w-max items-center gap-1 py-3">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isActive = activeStep === step.id;
              const isComplete = activeStep > step.id;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (step.id <= activeStep) setActiveStep(step.id);
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                    isActive &&
                      'bg-amber-400 text-black shadow-[0_0_24px_rgba(251,191,36,0.25)]',
                    !isActive &&
                      isComplete &&
                      'text-amber-200 hover:bg-amber-300/10',
                    !isActive &&
                      !isComplete &&
                      'cursor-not-allowed text-slate-600',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                      isActive && 'bg-black/15',
                      isComplete && 'bg-emerald-400/20 text-emerald-300',
                      !isActive && !isComplete && 'bg-white/5',
                    )}
                  >
                    {isComplete ? <Check className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                  </span>
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <form onSubmit={submitDraft} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {activeStep === 1 && (
              <section>
                <SectionHeading
                  eyebrow="Step 01"
                  title="What kind of card are you creating?"
                  description="Start with the card program. The content, layouts, and production notes adapt to this choice."
                />

                <div className="grid gap-5 md:grid-cols-3">
                  {PROGRAMS.map((item) => {
                    const ProgramIcon = item.icon;
                    const selected = program === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseProgram(item.id)}
                        className={cn(
                          'group overflow-hidden rounded-2xl border text-left transition-all',
                          selected
                            ? 'border-amber-300 bg-amber-300/[0.07] shadow-[0_0_28px_rgba(251,191,36,0.16)]'
                            : 'border-white/10 bg-white/[0.025] hover:border-white/25 hover:bg-white/[0.04]',
                        )}
                      >
                        <div className="relative aspect-[4/5] overflow-hidden bg-slate-900">
                          <Image
                            src={item.image}
                            alt={item.imageAlt}
                            fill
                            sizes="(min-width: 768px) 33vw, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                          <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur">
                            {selected ? (
                              <Check className="h-4 w-4 text-amber-300" />
                            ) : (
                              <ProgramIcon className="h-4 w-4 text-white" />
                            )}
                          </div>
                        </div>

                        <div className="p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                            {item.eyebrow}
                          </p>
                          <h2 className="mt-2 text-xl font-black text-white">
                            {item.title}
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 rounded-2xl border border-blue-300/15 bg-blue-400/[0.04] p-5 text-sm leading-6 text-slate-300">
                  <Info className="mr-2 inline h-4 w-4 text-blue-300" />
                  <span className="font-semibold text-blue-100">How this works:</span>{' '}
                  this first version collects production-ready details. You receive
                  a proof for review before the card enters production.
                </div>
              </section>
            )}

            {activeStep === 2 && (
              <section>
                <SectionHeading
                  eyebrow="Step 02"
                  title="Build the athlete and card story."
                  description="Add the information that belongs on the front and back of the selected card program."
                />

                <div className="space-y-8">
                  <Card className="border-white/10 bg-white/[0.025]">
                    <CardContent className="p-5 sm:p-7">
                      <h2 className="text-lg font-black text-white">
                        Athlete profile
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Required fields are marked with an asterisk.
                      </p>

                      <div className="mt-6 grid gap-5 md:grid-cols-2">
                        <Field
                          label="Athlete full name *"
                          value={form.athleteName}
                          onChange={(value) => updateForm('athleteName', value)}
                          placeholder="e.g., Nathaniel Gastelum"
                        />
                        <Field
                          label="Card display name"
                          value={form.displayName}
                          onChange={(value) => updateForm('displayName', value)}
                          placeholder="Name exactly as it should appear"
                        />
                        <Field
                          label="Moniker / nickname"
                          value={form.moniker}
                          onChange={(value) => updateForm('moniker', value)}
                          placeholder='e.g., "First Ink" or "The Cobra"'
                        />
                        <Field
                          label="Sport *"
                          value={form.sport}
                          onChange={(value) => updateForm('sport', value)}
                          placeholder="MMA, football, basketball, baseball..."
                        />
                        <Field
                          label="Team, school, gym, or club"
                          value={form.teamOrGym}
                          onChange={(value) => updateForm('teamOrGym', value)}
                          placeholder="e.g., 520 Fight Team"
                        />
                        <Field
                          label={isCombatSport ? 'Division / class' : 'Position / role'}
                          value={form.positionOrDivision}
                          onChange={(value) =>
                            updateForm('positionOrDivision', value)
                          }
                          placeholder={isCombatSport ? 'e.g., Flyweight' : 'e.g., Point Guard'}
                        />
                        <Field
                          label="Jersey number (optional)"
                          value={form.jerseyNumber}
                          onChange={(value) => updateForm('jerseyNumber', value)}
                          placeholder="e.g., 23"
                        />
                        <Field
                          label="Hometown (optional)"
                          value={form.hometown}
                          onChange={(value) => updateForm('hometown', value)}
                          placeholder="City, State"
                        />
                      </div>

                      <div className="mt-5">
                        <Label className="text-sm font-semibold text-slate-200">
                          Athlete bio
                        </Label>
                        <textarea
                          value={form.athleteBio}
                          onChange={(event) =>
                            updateForm('athleteBio', event.target.value)
                          }
                          placeholder="Share the athlete's story, background, goals, notable moments, or anything that should guide the card copy."
                          className="mt-2 min-h-32 border-white/10 bg-black/30 text-white placeholder:text-slate-600"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {program === 'event' && (
                    <Card className="border-amber-300/15 bg-amber-300/[0.025]">
                      <CardContent className="p-5 sm:p-7">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-300/10">
                            <CalendarDays className="h-5 w-5 text-amber-200" />
                          </div>
                          <div>
                            <h2 className="text-lg font-black text-white">
                              Event details
                            </h2>
                            <p className="text-sm text-slate-400">
                              These fields build the event identity around the athlete.
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-5 md:grid-cols-2">
                          <Field
                            label="Event name *"
                            value={form.eventName}
                            onChange={(value) => updateForm('eventName', value)}
                            placeholder="e.g., Rage in the Cage 24"
                          />
                          <Field
                            label="Event date"
                            type="date"
                            value={form.eventDate}
                            onChange={(value) => updateForm('eventDate', value)}
                          />
                          <Field
                            label="Venue"
                            value={form.eventVenue}
                            onChange={(value) => updateForm('eventVenue', value)}
                            placeholder="Venue name and city"
                          />
                          <Field
                            label="Promoter / organizer"
                            value={form.eventOrganizer}
                            onChange={(value) =>
                              updateForm('eventOrganizer', value)
                            }
                            placeholder="Promotion, school, league, organizer"
                          />
                          <div className="md:col-span-2">
                            <Field
                              label="Matchup / event headline"
                              value={form.matchup}
                              onChange={(value) => updateForm('matchup', value)}
                              placeholder="e.g., Gastelum vs. Ramirez — Co-Main Event"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-white/10 bg-white/[0.025]">
                    <CardContent className="p-5 sm:p-7">
                      <h2 className="text-lg font-black text-white">
                        Front and back layouts
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Pick one layout for each side. Final typography and media
                        crop are confirmed in the proof.
                      </p>

                      <div className="mt-6 grid gap-7 lg:grid-cols-2">
                        <LayoutChoiceGroup
                          label="Front layout"
                          layouts={availableFrontLayouts}
                          selected={frontLayout}
                          onSelect={(id) => setFrontLayout(id as FrontLayout)}
                        />
                        <LayoutChoiceGroup
                          label="Back layout"
                          layouts={availableBackLayouts}
                          selected={backLayout}
                          onSelect={(id) => setBackLayout(id as BackLayout)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/[0.025]">
                    <CardContent className="p-5 sm:p-7">
                      <h2 className="text-lg font-black text-white">
                        Stats, highlights, and story details
                      </h2>

                      {isCombatSport ? (
                        <div className="mt-6 grid gap-5 md:grid-cols-3">
                          <Field
                            label="Age"
                            value={form.age}
                            onChange={(value) => updateForm('age', value)}
                            placeholder="24"
                          />
                          <Field
                            label="Height"
                            value={form.height}
                            onChange={(value) => updateForm('height', value)}
                            placeholder={`5' 8"`}
                          />
                          <Field
                            label="Weight"
                            value={form.weight}
                            onChange={(value) => updateForm('weight', value)}
                            placeholder="155 lbs"
                          />
                          <Field
                            label="Reach"
                            value={form.reach}
                            onChange={(value) => updateForm('reach', value)}
                            placeholder={`71"`}
                          />
                          <Field
                            label="Stance"
                            value={form.stance}
                            onChange={(value) => updateForm('stance', value)}
                            placeholder="Orthodox / Southpaw"
                          />
                          <Field
                            label="Record"
                            value={form.record}
                            onChange={(value) => updateForm('record', value)}
                            placeholder="10–2–0"
                          />
                        </div>
                      ) : (
                        <div className="mt-6 grid gap-5 md:grid-cols-2">
                          <Field
                            label="Height"
                            value={form.height}
                            onChange={(value) => updateForm('height', value)}
                            placeholder={`e.g., 6' 1"`}
                          />
                          <Field
                            label="Weight"
                            value={form.weight}
                            onChange={(value) => updateForm('weight', value)}
                            placeholder="e.g., 185 lbs"
                          />
                          <Field
                            label="Primary statistic"
                            value={form.record}
                            onChange={(value) => updateForm('record', value)}
                            placeholder="e.g., 18 goals / 12 assists"
                          />
                          <Field
                            label="Graduation year / season"
                            value={form.age}
                            onChange={(value) => updateForm('age', value)}
                            placeholder="e.g., Class of 2027"
                          />
                        </div>
                      )}

                      <div className="mt-5 grid gap-5 md:grid-cols-2">
                        <Field
                          label="Titles, belts, awards, or honors"
                          value={form.titles}
                          onChange={(value) => updateForm('titles', value)}
                          placeholder="e.g., Regional Champion, 2026 Tournament MVP"
                        />
                        <Field
                          label="QR destination"
                          value={form.qrDestination}
                          onChange={(value) => updateForm('qrDestination', value)}
                          placeholder="Profile, highlight reel, ticket page, or sponsor offer"
                        />
                      </div>

                      <div className="mt-5">
                        <Label className="text-sm font-semibold text-slate-200">
                          Achievements / highlights
                        </Label>
                        <textarea
                          value={form.achievements}
                          onChange={(event) =>
                            updateForm('achievements', event.target.value)
                          }
                          placeholder="List milestones, wins, rankings, awards, season statistics, or the card's key story points."
                          className="mt-2 min-h-28 border-white/10 bg-black/30 text-white placeholder:text-slate-600"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {program === 'autograph' && (
                    <Card className="border-fuchsia-300/15 bg-fuchsia-300/[0.025]">
                      <CardContent className="p-5 sm:p-7">
                        <h2 className="text-lg font-black text-white">
                          Autograph edition settings
                        </h2>
                        <p className="mt-1 text-sm text-slate-400">
                          Tell production how the autograph should be handled.
                        </p>

                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                          <ChoiceCard
                            title="Sign in person"
                            description="Leave a blank signature panel for the athlete to sign later."
                            selected={form.autographMode === 'blank_panel'}
                            onClick={() =>
                              updateForm('autographMode', 'blank_panel')
                            }
                          />
                          <ChoiceCard
                            title="Pre-signed run"
                            description="Cards are signed by the athlete before they are fulfilled."
                            selected={form.autographMode === 'pre_signed'}
                            onClick={() =>
                              updateForm('autographMode', 'pre_signed')
                            }
                          />
                          <ChoiceCard
                            title="Printed signature"
                            description="A signature graphic is printed as art, not a hand-signed autograph."
                            selected={form.autographMode === 'printed_signature'}
                            onClick={() =>
                              updateForm('autographMode', 'printed_signature')
                            }
                          />
                        </div>

                        <div className="mt-6 grid gap-5 md:grid-cols-2">
                          <SelectField
                            label="Edition type"
                            value={form.editionType}
                            onChange={(value) => updateForm('editionType', value)}
                            options={[
                              { value: 'open', label: 'Open edition' },
                              { value: 'limited', label: 'Numbered limited run' },
                              {
                                value: 'event_exclusive',
                                label: 'Event-exclusive edition',
                              },
                            ]}
                          />
                          <Field
                            label="Edition size"
                            value={form.editionSize}
                            onChange={(value) => updateForm('editionSize', value)}
                            placeholder="e.g., 25, 50, 100"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </section>
            )}

            {activeStep === 3 && (
              <section>
                <SectionHeading
                  eyebrow="Step 03"
                  title="Choose the look and finish."
                  description="Give the production team enough direction to make the card feel personal, premium, and on-brand."
                />

                <Card className="border-white/10 bg-white/[0.025]">
                  <CardContent className="p-5 sm:p-7">
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field
                        label="Primary color"
                        value={form.primaryColor}
                        onChange={(value) => updateForm('primaryColor', value)}
                        placeholder="e.g., Red, black, gold, team color"
                      />
                      <Field
                        label="Accent color"
                        value={form.accentColor}
                        onChange={(value) => updateForm('accentColor', value)}
                        placeholder="e.g., Electric blue, silver, neon green"
                      />
                    </div>

                    <div className="mt-5">
                      <SelectField
                        label="Background / visual direction"
                        value={form.backgroundStyle}
                        onChange={(value) =>
                          updateForm('backgroundStyle', value)
                        }
                        options={[
                          { value: 'Energy / lightning', label: 'Energy / lightning' },
                          { value: 'Arena / stadium lights', label: 'Arena / stadium lights' },
                          { value: 'Smoke / fire', label: 'Smoke / fire' },
                          { value: 'Team / school branding', label: 'Team / school branding' },
                          { value: 'Clean premium', label: 'Clean premium' },
                          { value: 'Vintage / retro', label: 'Vintage / retro' },
                          { value: 'Custom direction', label: 'Custom direction' },
                        ]}
                      />
                    </div>

                    <div className="mt-8">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-black text-white">
                            Holographic finish
                          </h2>
                          <p className="mt-1 text-sm text-slate-400">
                            Choose a finish, or let the supplier match it to the
                            proof.
                          </p>
                        </div>
                        <Sparkles className="h-5 w-5 text-amber-300" />
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {HOLOGRAPHIC_FINISHES.map((finish) => {
                          const selected = holographicFinish === finish.id;

                          return (
                            <button
                              key={finish.id}
                              type="button"
                              onClick={() => setHolographicFinish(finish.id)}
                              className={cn(
                                'rounded-xl border p-3 text-left transition-all',
                                selected
                                  ? 'border-amber-300 bg-amber-300/[0.07] shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                                  : 'border-white/10 bg-black/20 hover:border-white/25',
                              )}
                            >
                              <div
                                className={cn(
                                  'h-12 rounded-lg bg-gradient-to-br',
                                  finish.className,
                                )}
                              />
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-white">
                                  {finish.title}
                                </span>
                                {selected && (
                                  <Check className="h-4 w-4 text-amber-300" />
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {finish.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-7">
                      <Label className="text-sm font-semibold text-slate-200">
                        Special design instructions
                      </Label>
                      <textarea
                        value={form.specialInstructions}
                        onChange={(event) =>
                          updateForm('specialInstructions', event.target.value)
                        }
                        placeholder="Mention color priorities, visual references, must-use text, things to avoid, preferred photo crop, or anything else production should know."
                        className="mt-2 min-h-36 border-white/10 bg-black/30 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeStep === 4 && (
              <section>
                <SectionHeading
                  eyebrow="Step 04"
                  title="Add sponsors and brand partners."
                  description="Use the card as sponsor inventory without crowding the athlete, event, or autograph area."
                />

                <Card className="border-white/10 bg-white/[0.025]">
                  <CardContent className="p-5 sm:p-7">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <h2 className="text-lg font-black text-white">
                          Sponsor & brand partners
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                          The recommended default is a back sponsor strip. Keep the
                          card collectible: one featured front sponsor at most, with
                          up to five total sponsors in this first version.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={sponsors.length >= 5}
                        onClick={addSponsor}
                        className="border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15"
                      >
                        <CircleDollarSign className="mr-2 h-4 w-4" />
                        Add sponsor
                      </Button>
                    </div>

                    {sponsors.length === 0 ? (
                      <div className="mt-7 rounded-xl border border-dashed border-white/15 bg-black/20 p-7 text-center">
                        <CircleDollarSign className="mx-auto h-7 w-7 text-slate-600" />
                        <p className="mt-3 text-sm font-semibold text-slate-300">
                          No sponsors added yet.
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          You can proceed with no sponsors, or add partners for the
                          athlete, event, promotion, gym, or series.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-7 space-y-4">
                        {sponsors.map((sponsor, index) => (
                          <div
                            key={sponsor.id}
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                                Sponsor {index + 1}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeSponsor(sponsor.id)}
                                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-red-400/10 hover:text-red-300"
                                aria-label={`Remove sponsor ${index + 1}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <Field
                                label="Sponsor name"
                                value={sponsor.name}
                                onChange={(value) =>
                                  updateSponsor(sponsor.id, 'name', value)
                                }
                                placeholder="Brand or organization"
                              />
                              <SelectField
                                label="Tier"
                                value={sponsor.tier}
                                onChange={(value) =>
                                  updateSponsor(sponsor.id, 'tier', value)
                                }
                                options={[
                                  { value: 'featured', label: 'Featured partner' },
                                  { value: 'primary', label: 'Primary sponsor' },
                                  { value: 'supporting', label: 'Supporting sponsor' },
                                  { value: 'event_partner', label: 'Event partner' },
                                ]}
                              />
                              <SelectField
                                label="Placement preference"
                                value={sponsor.placement}
                                onChange={(value) =>
                                  updateSponsor(sponsor.id, 'placement', value)
                                }
                                options={[
                                  { value: 'front_footer', label: 'Front footer' },
                                  { value: 'front_corner', label: 'Front corner' },
                                  { value: 'back_strip', label: 'Back sponsor strip' },
                                  { value: 'back_grid', label: 'Back partner grid' },
                                ]}
                              />
                              <Field
                                label="Website / destination"
                                value={sponsor.websiteUrl}
                                onChange={(value) =>
                                  updateSponsor(sponsor.id, 'websiteUrl', value)
                                }
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-7 rounded-xl border border-blue-300/15 bg-blue-300/[0.04] p-4 text-xs leading-6 text-slate-300">
                      <Star className="mr-2 inline h-4 w-4 text-blue-300" />
                      Sponsor logos are uploaded in the next step. The production
                      proof confirms final legibility, spacing, and card placement.
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {activeStep === 5 && (
              <section>
                <SectionHeading
                  eyebrow="Step 05"
                  title="Upload the media."
                  description="Use the highest-resolution originals available. Organize files by purpose so the production team knows where they belong."
                />

                <div className="space-y-6">
                  <UploadPanel
                    title="Primary athlete photo *"
                    description="Upload the main image intended for the card front."
                    assets={primaryPhotos}
                    maxCount={1}
                    accept="image/png,image/jpeg,image/webp"
                    onAdd={(event) => addAssets(event, setPrimaryPhotos, 1)}
                    onRemove={(id) => removeAsset(id, setPrimaryPhotos)}
                  />

                  <UploadPanel
                    title="Additional athlete photos"
                    description="Action photos, alternate portraits, or event photography."
                    assets={additionalPhotos}
                    maxCount={5}
                    accept="image/png,image/jpeg,image/webp"
                    onAdd={(event) => addAssets(event, setAdditionalPhotos, 5)}
                    onRemove={(id) => removeAsset(id, setAdditionalPhotos)}
                  />

                  <UploadPanel
                    title="Team, gym, school, promotion, or event logos"
                    description="Upload transparent PNG or high-resolution logo assets where possible."
                    assets={logos}
                    maxCount={4}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onAdd={(event) => addAssets(event, setLogos, 4)}
                    onRemove={(id) => removeAsset(id, setLogos)}
                  />

                  <UploadPanel
                    title="Sponsor logos"
                    description="Upload sponsor-brand assets separately from athlete/event logos."
                    assets={sponsorLogos}
                    maxCount={5}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onAdd={(event) => addAssets(event, setSponsorLogos, 5)}
                    onRemove={(id) => removeAsset(id, setSponsorLogos)}
                  />

                  <UploadPanel
                    title="Design references"
                    description="Optional examples, mood boards, existing card art, or signed-card references."
                    assets={referenceFiles}
                    maxCount={3}
                    accept="image/png,image/jpeg,image/webp"
                    onAdd={(event) => addAssets(event, setReferenceFiles, 3)}
                    onRemove={(id) => removeAsset(id, setReferenceFiles)}
                  />

                  <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-5 text-sm leading-6 text-slate-300">
                    <ShieldCheck className="mr-2 inline h-4 w-4 text-amber-200" />
                    Upload only photos, logos, trademarks, and signatures you are
                    authorized to use. The final proof is the opportunity to verify
                    all content before production.
                  </div>
                </div>
              </section>
            )}

            {activeStep === 6 && (
              <section>
                <SectionHeading
                  eyebrow="Step 06"
                  title="Review and submit your request."
                  description="This is a local UI prototype. Submission currently displays a confirmation state only; it does not yet create an order or send assets to the supplier."
                />

                <div className="space-y-6">
                  <Card className="border-amber-300/20 bg-gradient-to-br from-amber-300/[0.07] to-transparent">
                    <CardContent className="p-5 sm:p-7">
                      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                        <div>
                          <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100">
                            {programLabel(program)}
                          </Badge>
                          <h2 className="mt-4 text-2xl font-black text-white">
                            {form.displayName || form.athleteName || 'Your Athlete Card'}
                          </h2>
                          <p className="mt-2 text-sm text-slate-300">
                            {form.sport || 'Sport not set'}
                            {form.teamOrGym ? ` · ${form.teamOrGym}` : ''}
                            {program === 'event' && form.eventName
                              ? ` · ${form.eventName}`
                              : ''}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                            Production route
                          </p>
                          <p className="mt-1 text-sm font-semibold text-amber-200">
                            Proof required
                          </p>
                        </div>
                      </div>

                      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryItem
                          label="Front"
                          value={
                            FRONT_LAYOUTS.find(
                              (layout) => layout.id === frontLayout,
                            )?.title || 'Not selected'
                          }
                        />
                        <SummaryItem
                          label="Back"
                          value={
                            BACK_LAYOUTS.find((layout) => layout.id === backLayout)
                              ?.title || 'Not selected'
                          }
                        />
                        <SummaryItem
                          label="Finish"
                          value={
                            HOLOGRAPHIC_FINISHES.find(
                              (finish) => finish.id === holographicFinish,
                            )?.title || 'Not selected'
                          }
                        />
                        <SummaryItem
                          label="Sponsors"
                          value={`${sponsors.length} listed`}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/[0.025]">
                    <CardContent className="p-5 sm:p-7">
                      <h2 className="text-lg font-black text-white">
                        Contact and production details
                      </h2>

                      <div className="mt-6 grid gap-5 md:grid-cols-2">
                        <Field
                          label="Your name *"
                          value={form.customerName}
                          onChange={(value) => updateForm('customerName', value)}
                          placeholder="Submitting adult, athlete, manager, or organizer"
                        />
                        <Field
                          label="Email address *"
                          type="email"
                          value={form.customerEmail}
                          onChange={(value) =>
                            updateForm('customerEmail', value)
                          }
                          placeholder="name@example.com"
                        />
                        <Field
                          label="Phone number"
                          type="tel"
                          value={form.customerPhone}
                          onChange={(value) => updateForm('customerPhone', value)}
                          placeholder="Optional, for proof / production questions"
                        />
                        <Field
                          label="Requested quantity"
                          value={form.cardQuantity}
                          onChange={(value) => updateForm('cardQuantity', value)}
                          placeholder="e.g., 25, 50, 100, or discuss after proof"
                        />
                      </div>

                      <div className="mt-7 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
                        <CheckRow
                          checked={form.rightsConfirmed}
                          onChange={(checked) =>
                            updateForm('rightsConfirmed', checked)
                          }
                          label="I confirm that I have permission to use the athlete's name, image, and submitted media."
                        />
                        <CheckRow
                          checked={form.sponsorRightsConfirmed}
                          onChange={(checked) =>
                            updateForm('sponsorRightsConfirmed', checked)
                          }
                          label="I confirm that I am authorized to use every submitted team, event, gym, school, and sponsor logo."
                        />
                        <CheckRow
                          checked={form.guardianConsentConfirmed}
                          onChange={(checked) =>
                            updateForm('guardianConsentConfirmed', checked)
                          }
                          label="If the athlete is a minor, I confirm that I am the parent, guardian, or authorized submitting adult."
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            )}

            <div className="mt-10 flex items-center justify-between gap-4 border-t border-white/10 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={activeStep === 1}
                className="border-white/15 bg-white/[0.025] text-white hover:bg-white/[0.08]"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>

              {activeStep < 6 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={!canAdvance()}
                  className="bg-amber-400 font-black text-black hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!canAdvance() || submitting}
                  className="bg-emerald-500 font-black text-black hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting draft...
                    </>
                  ) : (
                    <>
                      Submit Card Request
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card className="overflow-hidden border-amber-300/20 bg-[#0b1020]">
              <CardContent className="p-0">
                <div className="relative aspect-[5/7] overflow-hidden bg-black">
                  {primaryPhotos[0] ? (
                    <Image
                      src={primaryPhotos[0].previewUrl}
                      alt="Primary athlete upload preview"
                      fill
                      unoptimized
                      className="object-cover opacity-70"
                    />
                  ) : (
                    <Image
                      src={
                        program === 'autograph'
                            ? '/athlete-cards/first-ink-template-card-sample.jpeg'
                            : program === 'event'
                            ? '/athlete-cards/nate-tc-mock-front.jpeg'
                            : '/athlete-cards/nate-tc-mock-back.jpeg'
                        }
                      alt="Card layout example"
                      fill
                      sizes="320px"
                      className="object-cover opacity-65"
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <Badge className="border-amber-300/25 bg-black/40 text-amber-100 backdrop-blur">
                      LIVE REQUEST SUMMARY
                    </Badge>
                    <h2 className="mt-3 text-2xl font-black leading-tight text-white">
                      {form.displayName || form.athleteName || 'YOUR ATHLETE'}
                    </h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-200">
                      {programLabel(program)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  <SummaryItem
                    label="Front"
                    value={
                      FRONT_LAYOUTS.find((layout) => layout.id === frontLayout)
                        ?.title || 'Not selected'
                    }
                  />
                  <SummaryItem
                    label="Back"
                    value={
                      BACK_LAYOUTS.find((layout) => layout.id === backLayout)
                        ?.title || 'Not selected'
                    }
                  />
                  <SummaryItem
                    label="Finish"
                    value={
                      HOLOGRAPHIC_FINISHES.find(
                        (finish) => finish.id === holographicFinish,
                      )?.title || 'Not selected'
                    }
                  />
                  <SummaryItem
                    label="Assets"
                    value={`${primaryPhotos.length} primary · ${
                      additionalPhotos.length +
                      logos.length +
                      sponsorLogos.length +
                      referenceFiles.length
                    } additional`}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
                Included in the request
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  Front and back layout selection
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  Athlete, event, bio, and stat details
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  Holographic-finish preference
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  Sponsor and brand-partner direction
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  Proof before production
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </form>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-sm font-semibold text-slate-200">{label}</Label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 flex h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <Label className="text-sm font-semibold text-slate-200">{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 flex h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-slate-950 text-white"
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 text-left transition-all',
        selected
          ? 'border-fuchsia-300 bg-fuchsia-300/[0.08]'
          : 'border-white/10 bg-black/20 hover:border-white/25',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-white">{title}</p>
        {selected && <Check className="h-4 w-4 text-fuchsia-200" />}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
    </button>
  );
}

function LayoutChoiceGroup({
  label,
  layouts,
  selected,
  onSelect,
}: {
  label: string;
  layouts: Array<{ id: string; title: string; description: string }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-300">
        {label}
      </p>
      <div className="mt-3 space-y-3">
        {layouts.map((layout) => {
          const isSelected = layout.id === selected;

          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => onSelect(layout.id)}
              className={cn(
                'flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left transition-all',
                isSelected
                  ? 'border-amber-300 bg-amber-300/[0.07]'
                  : 'border-white/10 bg-black/20 hover:border-white/25',
              )}
            >
              <div>
                <p className="text-sm font-bold text-white">{layout.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {layout.description}
                </p>
              </div>
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  isSelected
                    ? 'border-amber-300 bg-amber-300 text-black'
                    : 'border-white/20',
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UploadPanel({
  title,
  description,
  assets,
  maxCount,
  accept,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  assets: UploadedAsset[];
  maxCount: number;
  accept: string;
  onAdd: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
}) {
  const inputId = `upload-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <Card className="border-white/10 bg-white/[0.025]">
      <CardContent className="p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          <Badge className="w-fit border-white/10 bg-white/[0.05] text-slate-300">
            {assets.length}/{maxCount}
          </Badge>
        </div>

        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={maxCount > 1}
          className="hidden"
          onChange={onAdd}
          disabled={assets.length >= maxCount}
        />

        <label
          htmlFor={inputId}
          className={cn(
            'mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-7 text-center transition-colors',
            assets.length >= maxCount
              ? 'cursor-not-allowed border-white/5 bg-black/10 opacity-50'
              : 'border-white/15 bg-black/20 hover:border-amber-300/40 hover:bg-amber-300/[0.035]',
          )}
        >
          <ImagePlus className="h-7 w-7 text-amber-300" />
          <span className="mt-3 text-sm font-bold text-white">
            Select image file{maxCount > 1 ? 's' : ''}
          </span>
          <span className="mt-1 text-xs text-slate-500">
            PNG, JPG, WEBP{accept.includes('svg') ? ', or SVG' : ''} · up to{' '}
            {maxCount} file{maxCount > 1 ? 's' : ''}
          </span>
        </label>

        {assets.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/30"
              >
                <div className="relative aspect-square">
                  <Image
                    src={asset.previewUrl}
                    alt={asset.file.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>

                <div className="border-t border-white/10 p-2">
                  <p className="truncate text-[10px] text-slate-400">
                    {asset.file.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(asset.id)}
                  className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/60 p-1.5 text-white opacity-100 transition-colors hover:border-red-300 hover:bg-red-500/80 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Remove ${asset.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-200" title={value}>
        {value}
      </p>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-black accent-amber-400"
      />
      <span>{label}</span>
    </label>
  );
}