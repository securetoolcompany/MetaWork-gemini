export const ACADEMY_PATHWAYS = [
  {
    id: 'start-here',
    slug: 'start-here',
    title: 'Start Here',
    eyebrow: 'MetaWork Academy // First Steps',
    heroTitle: 'Start building with MetaWork.',
    heroDescription:
      'A practical launch path for learners who want to understand the MetaWork platform, set up a public presence, protect their work, and begin using the tools with confidence.',

    audience: ['creators', 'students', 'educators'],
    level: 'beginner',
    estimatedMinutes: 90,

    access: 'public',
    publishStatus: 'published',
    sortOrder: 10,

    accent: {
      primary: '#22D3EE',
      secondary: '#2563EB',
    },
    outcome:
      'By the end of this pathway, learners understand the core MetaWork workflow and have a clear next step for creating, building, or sharing their work.',
    milestones: [
      {
        number: '01',
        label: 'Explore',
        title: 'Understand the ecosystem',
        description:
          'Learn what MetaWork is designed to help creators, students, and educators build.',
      },
      {
        number: '02',
        label: 'Set up',
        title: 'Create your foundation',
        description:
          'Set up an Aisle, understand basic account tools, and prepare a public-facing starting point.',
      },
      {
        number: '03',
        label: 'Create',
        title: 'Choose your next move',
        description:
          'Move into creator commerce, IP ownership, wallet readiness, or an education-focused path.',
      },
    ],

    relatedCourseSlugs: [
      'blockchain-basics',
      'design-ip-creation',
    ],
    librarySections: ['start-here'],
    recommendedLessonSlugs: [
      'how-to-create-your-metawork-aisle',
      'how-to-mint-documents-on-metawork',
      'set-up-phantom-wallet',
    ],
  },
  {
    id: 'creator-commerce',
    slug: 'creator-commerce',
    title: 'Creator Commerce',
    eyebrow: 'MetaWork Academy // Creator Path',
    heroTitle: 'Turn what you create into something you can build on.',
    heroDescription:
      'Learn the practical pieces of creator commerce: shaping an offer, building a storefront, organizing products, preparing creative work, and developing the skills to bring your work to market.',

    audience: ['creators', 'students'],
    level: 'beginner',
    estimatedMinutes: 240,

    access: 'public',
    publishStatus: 'published',
    sortOrder: 20,

    accent: {
      primary: '#22D3EE',
      secondary: '#34D399',
    },
    outcome:
      'By the end of this pathway, learners can connect a creative idea to a practical product, storefront, and market-ready plan.',
    milestones: [
      {
        number: '01',
        label: 'Define',
        title: 'Shape the offer',
        description:
          'Identify an audience, clarify a product or creative direction, and understand what makes an offer useful.',
      },
      {
        number: '02',
        label: 'Build',
        title: 'Create the storefront',
        description:
          'Set up an Aisle, organize products, and prepare a clear public-facing place for people to discover your work.',
      },
      {
        number: '03',
        label: 'Launch',
        title: 'Bring it to market',
        description:
          'Use product, pricing, marketing, and sales fundamentals to move from a concept to real opportunity.',
      },
    ],

    relatedCourseSlugs: [
      'design-ip-creation',
      'sales-client-acquisition',
    ],
    librarySections: ['creator-commerce', 'start-here'],
    recommendedLessonSlugs: [
      'how-to-create-your-metawork-aisle',
      'how-to-mint-documents-on-metawork',
      'how-to-claim-your-payouts',
    ],
  },
  {
    id: 'ip-and-ownership',
    slug: 'ip-and-ownership',
    title: 'IP & Ownership',
    eyebrow: 'MetaWork Academy // Ownership Path',
    heroTitle: 'Create work. Protect what is yours.',
    heroDescription:
      'Build practical confidence around digital ownership, intellectual property, documentation, licensing concepts, and preparing creative work for real-world use.',

    audience: ['creators', 'students', 'educators'],
    level: 'beginner',
    estimatedMinutes: 210,

    access: 'public',
    publishStatus: 'published',
    sortOrder: 30,

    accent: {
      primary: '#34D399',
      secondary: '#22D3EE',
    },
    outcome:
      'By the end of this pathway, learners understand how to prepare, document, and make more intentional decisions about creative work and ownership.',
    milestones: [
      {
        number: '01',
        label: 'Create',
        title: 'Build original work',
        description:
          'Develop designs, creative assets, and ideas with originality, quality, and practical use in mind.',
      },
      {
        number: '02',
        label: 'Document',
        title: 'Prepare work for ownership',
        description:
          'Use metadata, source files, documentation, and practical IP preparation habits to organize creative work.',
      },
      {
        number: '03',
        label: 'Use',
        title: 'Understand licensing and value',
        description:
          'Explore how permissions, licensing decisions, products, and creative ownership can connect to opportunity.',
      },
    ],

    relatedCourseSlugs: [
      'blockchain-basics',
      'design-ip-creation',
    ],
    librarySections: ['ip-and-ownership'],
    recommendedLessonSlugs: [
      'how-to-mint-documents-on-metawork',
      'how-to-create-your-metawork-aisle',
    ],
  },
  {
    id: 'wallets-and-payouts',
    slug: 'wallets-and-payouts',
    title: 'Wallets & Payouts',
    eyebrow: 'MetaWork Academy // Wallet Path',
    heroTitle: 'Understand the tools behind ownership and payouts.',
    heroDescription:
      'Build practical confidence with wallets, keys, transactions, security habits, revenue concepts, and the steps required to participate safely in MetaWork payout workflows.',

    audience: ['creators', 'students'],
    level: 'beginner',
    estimatedMinutes: 180,

    access: 'public',
    publishStatus: 'published',
    sortOrder: 40,

    accent: {
      primary: '#FBBF24',
      secondary: '#2563EB',
    },
    outcome:
      'By the end of this pathway, learners have a clearer understanding of wallet readiness, safer digital-asset practices, and how payout workflows connect to real work.',
    milestones: [
      {
        number: '01',
        label: 'Prepare',
        title: 'Set up safer access',
        description:
          'Understand wallets, public and private keys, recovery practices, and foundational security habits.',
      },
      {
        number: '02',
        label: 'Verify',
        title: 'Understand transactions',
        description:
          'Learn how transactions work, what fees are, and how to verify movement of value with more confidence.',
      },
      {
        number: '03',
        label: 'Claim',
        title: 'Connect work to payouts',
        description:
          'Understand revenue pools, payment readiness, and the practical workflow for claiming available payouts.',
      },
    ],

    relatedCourseSlugs: ['blockchain-basics'],
    librarySections: ['wallets-and-payouts'],
    recommendedLessonSlugs: [
      'set-up-phantom-wallet',
      'how-to-claim-your-payouts',
      'how-to-mint-documents-on-metawork',
    ],
  },
  {
    id: 'schools-and-programs',
    slug: 'schools-and-programs',
    title: 'Schools & Programs',
    eyebrow: 'MetaWork Academy // Educator Path',
    heroTitle: 'Bring practical opportunity into learning.',
    heroDescription:
      'Explore how MetaWork Academy can support educators, programs, CTE pathways, DECA advisors, schools, and community partners with project-based learning that connects technology, creativity, entrepreneurship, and real-world outcomes.',

    audience: ['educators', 'students'],
    level: 'all-levels',
    estimatedMinutes: 60,

    access: 'public',
    publishStatus: 'published',
    sortOrder: 50,

    accent: {
      primary: '#2563EB',
      secondary: '#34D399',
    },
    outcome:
      'By the end of this pathway, educators and partners can identify a practical way to introduce MetaWork Academy through a course, workshop, project, or broader partnership.',
    milestones: [
      {
        number: '01',
        label: 'Explore',
        title: 'Choose a starting point',
        description:
          'Identify whether a workshop, standalone course, project, or school partnership is the right first move.',
      },
      {
        number: '02',
        label: 'Align',
        title: 'Match the learner need',
        description:
          'Connect Academy resources to entrepreneurship, CTE, DECA, design, marketing, technology, or career-readiness goals.',
      },
      {
        number: '03',
        label: 'Launch',
        title: 'Build the program',
        description:
          'Plan delivery, educator support, learner access, course selection, projects, and future expansion.',
      },
    ],

    relatedCourseSlugs: [
      'blockchain-basics',
      'design-ip-creation',
      'sales-client-acquisition',
    ],
    librarySections: ['schools-and-programs'],
    recommendedLessonSlugs: [
      'ingeniatec-2025-symposium-wrap-up',
      'how-to-create-your-metawork-aisle',
    ],
  },
];

export function getAcademyPathwayBySlug(slug) {
  return ACADEMY_PATHWAYS.find((pathway) => pathway.slug === slug);
}

export function getPublishedAcademyPathways() {
  return ACADEMY_PATHWAYS.filter(
    (pathway) => pathway.publishStatus === 'published'
  ).sort((first, second) => first.sortOrder - second.sortOrder);
}