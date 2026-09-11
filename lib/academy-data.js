export const ACADEMY_AUDIENCES = [
  { id: 'creators', label: 'Creators' },
  { id: 'students', label: 'Students' },
  { id: 'educators', label: 'Educators & Partners' },
];

export const ACADEMY_TOPICS = [
  { id: 'creator-commerce', label: 'Creator Commerce' },
  { id: 'digital-storefronts', label: 'Digital Storefronts' },
  { id: 'product-development', label: 'Product Development' },
  { id: 'entrepreneurship', label: 'Entrepreneurship' },
  { id: 'ip-licensing', label: 'IP & Licensing' },
  { id: 'blockchain', label: 'Blockchain & Wallets' },
  { id: 'revenue-sharing', label: 'Revenue Sharing' },
  { id: 'education-programs', label: 'Education Programs' },
];

export const ACADEMY_FORMATS = [
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'case-study', label: 'Case Study' },
  { id: 'program-overview', label: 'Program Overview' },
  { id: 'quick-guide', label: 'Quick Guide' },
];

export const ACADEMY_SECTIONS = [
  {
    id: 'start-here',
    slug: 'start-here',
    title: 'Start Here',
    description:
      'Learn the core MetaWork tools and workflows for building, publishing, and growing.',
    icon: 'Sparkles',
    audience: ['creators', 'students', 'educators'],
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'creator-commerce',
    slug: 'creator-commerce',
    title: 'Creator Commerce',
    description:
      'Turn creative work, products, and audience relationships into an organized commerce system.',
    icon: 'Store',
    audience: ['creators', 'students'],
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'ip-and-ownership',
    slug: 'ip-and-ownership',
    title: 'IP & Ownership',
    description:
      'Understand authentication, ownership records, licensing, and protecting your creative work.',
    icon: 'ShieldCheck',
    audience: ['creators', 'students', 'educators'],
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'wallets-and-payouts',
    slug: 'wallets-and-payouts',
    title: 'Wallets & Payouts',
    description:
      'Connect wallets, understand revenue pools, and claim available payouts.',
    icon: 'Wallet',
    audience: ['creators', 'students'],
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: 'schools-and-programs',
    slug: 'schools-and-programs',
    title: 'Schools & Programs',
    description:
      'Resources for educators, CTE programs, entrepreneurship pathways, and school partners.',
    icon: 'GraduationCap',
    audience: ['educators', 'students'],
    accent: 'from-rose-500 to-pink-500',
  },
];

export const ACADEMY_SERVICES = [
  {
    slug: 'workshops',
    title: 'Workshops',
    description:
      'Hands-on sessions that introduce students, creators, and teams to practical digital-commerce workflows.',
    icon: 'Presentation',
  },
  {
    slug: 'curriculum-design',
    title: 'Curriculum Design',
    description:
      'Custom learning experiences that connect entrepreneurship, product development, and real-world technology.',
    icon: 'BookOpenCheck',
  },
  {
    slug: 'online-courses',
    title: 'Online Courses',
    description:
      'Structured learning programs built from practical MetaWork tools, examples, and guided activities.',
    icon: 'MonitorPlay',
  },
  {
    slug: 'esa-programs',
    title: 'ESA Programs',
    description:
      'Flexible educational programming that supports personalized and family-directed learning pathways.',
    icon: 'Landmark',
  },
  {
    slug: 'school-partnerships',
    title: 'School Partnerships',
    description:
      'Collaborative programs for schools, districts, and organizations building modern student opportunities.',
    icon: 'Handshake',
  },
  {
    slug: 'cte-deca',
    title: 'CTE & DECA Support',
    description:
      'Applied entrepreneurship and commerce resources designed for career and technical education programs.',
    icon: 'BadgeCheck',
  },
];

export const ACADEMY_VIDEOS = [
  {
    id: 'how-to-create-your-metawork-aisle',
    slug: 'how-to-create-your-metawork-aisle',
    youtubeId: 'C7fZOMgukIw',
    youtubeUrl: 'https://www.youtube.com/watch?v=C7fZOMgukIw',
    title: 'How to Create Your MetaWork Aisle',
    description:
      'A full walkthrough for setting up your public MetaWork Aisle, editing storefront information, adding products, creating sections, and publishing your updates.',
    learningOutcomes: [
      'Navigate to the Aisle creator',
      'Customize branding and contact details',
      'Add, arrange, and publish products',
    ],

    audience: ['creators', 'students', 'educators'],
    topics: ['creator-commerce', 'digital-storefronts', 'product-development'],
    format: 'tutorial',
    level: 'start-here',

    access: 'public',
    publishStatus: 'published',
    productionStatus: 'recorded',
    primaryPathwaySlug: 'start-here',

    featuredRank: 1,
    sortOrder: 10,
    publishedAt: '2026-09-08T00:00:00.000Z',
    durationLabel: '10+ min',
  },
  {
    id: 'how-to-claim-your-payouts',
    slug: 'how-to-claim-your-payouts',
    youtubeId: 'QdXtmi80h-U',
    youtubeUrl: 'https://www.youtube.com/watch?v=QdXtmi80h-U',
    title: 'How to Claim Your Payouts on the MetaWork Platform',
    description:
      'Learn how to verify your wallet, locate revenue pools, review available USDC payouts, and claim eligible revenue from your MetaWork account.',
    learningOutcomes: [
      'Verify and connect a wallet',
      'Locate revenue pools',
      'Claim available USDC payouts',
    ],

    audience: ['creators', 'students'],
    topics: ['revenue-sharing', 'blockchain', 'creator-commerce'],
    format: 'tutorial',
    level: 'building-skills',

    access: 'public',
    publishStatus: 'published',
    productionStatus: 'recorded',
    primaryPathwaySlug: 'wallets-and-payouts',

    featuredRank: 2,
    sortOrder: 20,
    publishedAt: '2026-09-08T00:00:00.000Z',
    durationLabel: '5+ min',
  },
  {
    id: 'how-to-mint-documents-on-metawork',
    slug: 'how-to-mint-documents-on-metawork',
    youtubeId: '1rC0h-QPE0o',
    youtubeUrl: 'https://www.youtube.com/watch?v=1rC0h-QPE0o',
    title: 'How to Mint Documents on MetaWork',
    description:
      'Understand the difference between minting and tokenization, then follow the process for authenticating documents on-chain through MetaWork.',
    learningOutcomes: [
      'Understand minting versus tokenization',
      'Prepare documents for authentication',
      'Complete the MetaWork minting workflow',
    ],

    audience: ['creators', 'students', 'educators'],
    topics: ['ip-licensing', 'blockchain', 'product-development'],
    format: 'tutorial',
    level: 'start-here',

    access: 'public',
    publishStatus: 'published',
    productionStatus: 'recorded',
    primaryPathwaySlug: 'ip-and-ownership',

    featuredRank: 3,
    sortOrder: 30,
    publishedAt: '2026-05-26T00:00:00.000Z',
    durationLabel: '5+ min',
  },
  {
    id: 'set-up-phantom-wallet',
    slug: 'set-up-phantom-wallet',
    youtubeId: 'jdmLfPBAj8Q',
    youtubeUrl: 'https://www.youtube.com/watch?v=jdmLfPBAj8Q',
    title: 'How to Set Up a Phantom Wallet for the Solana Blockchain',
    description:
      'A practical introduction to setting up a Phantom wallet and preparing to interact with Solana-based tools.',
    learningOutcomes: [
      'Set up a Phantom wallet',
      'Understand essential wallet safety basics',
      'Prepare for Solana-based workflows',
    ],

    audience: ['creators', 'students'],
    topics: ['blockchain'],
    format: 'quick-guide',
    level: 'start-here',

    access: 'public',
    publishStatus: 'published',
    productionStatus: 'recorded',
    primaryPathwaySlug: 'wallets-and-payouts',

    featuredRank: 4,
    sortOrder: 40,
    publishedAt: '2025-10-20T00:00:00.000Z',
    durationLabel: 'Quick guide',
  },
  {
    id: 'ingeniatec-2025-symposium-wrap-up',
    slug: 'ingeniatec-2025-symposium-wrap-up',
    youtubeId: 'kWYuJY5ELzI',
    youtubeUrl: 'https://www.youtube.com/shorts/kWYuJY5ELzI',
    title: 'Ingeniatec 2025 Symposium: Post-Presentation Wrap Up',
    description:
      'A brief MetaWork reflection following the Ingeniatec 2025 Symposium presentation.',
    learningOutcomes: [
      'See MetaWork in an education and innovation setting',
      'Learn about the broader program conversation',
    ],

    audience: ['educators', 'students', 'creators'],
    topics: ['education-programs', 'entrepreneurship'],
    format: 'case-study',
    level: 'start-here',

    access: 'public',
    publishStatus: 'published',
    productionStatus: 'recorded',
    primaryPathwaySlug: 'schools-and-programs',

    featuredRank: 5,
    sortOrder: 50,
    publishedAt: '2025-11-20T00:00:00.000Z',
    durationLabel: 'Short',
  },
  {
    id: 'academy-members-preview',
    slug: 'academy-members-preview',
    youtubeId: null,
    youtubeUrl: null,
    title: 'Building a Complete Creator Commerce System',
    description:
      'A future member-exclusive learning path for moving from idea through product, storefront, ownership, and revenue workflows.',
    learningOutcomes: [
      'Build a repeatable creator-commerce workflow',
      'Connect product, storefront, and ownership decisions',
      'Use advanced MetaWork tools strategically',
    ],

    audience: ['creators', 'students'],
    topics: ['creator-commerce', 'digital-storefronts', 'revenue-sharing'],
    format: 'workshop',
    level: 'advanced',

    access: 'members',
    publishStatus: 'draft',
    productionStatus: 'planned',
    primaryPathwaySlug: 'creator-commerce',

    featuredRank: null,
    sortOrder: 60,
    publishedAt: null,
    durationLabel: 'Coming soon',
  },
];

export function getYoutubeThumbnail(youtubeId) {
  if (!youtubeId) return null;
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function getSectionById(sectionId) {
  return ACADEMY_SECTIONS.find((section) => section.id === sectionId);
}

export function getFeaturedVideos(limit = 3) {
  return ACADEMY_VIDEOS
    .filter((video) => video.featuredRank)
    .sort((a, b) => a.featuredRank - b.featuredRank)
    .slice(0, limit);
}