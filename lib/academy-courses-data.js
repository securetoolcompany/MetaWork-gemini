export const ACADEMY_COURSES = [
  {
    id: 'blockchain-basics',
    slug: 'blockchain-basics',
    title: 'Blockchain Basics',
    subtitle: 'Create the foundation.',
    shortDescription:
      'A practical six-lesson introduction to blockchain, digital ownership, wallets, transactions, security, and MetaWork opportunity.',
    description:
      'Blockchain Basics gives learners a practical foundation for understanding blockchain technology and participating safely in the digital economy. Students explore wallets, keys, transactions, digital ownership, security, and how MetaWork tools can support creating, building, and earning.',
    audience: ['students', 'educators', 'creators'],
    topics: [
      'blockchain',
      'digital-ownership',
      'wallets',
      'transactions',
      'security',
      'entrepreneurship',
    ],
    level: 'beginner',
    enrollmentType: 'approval',
    access: 'school-partner',
    publishStatus: 'published',
    productionStatus: 'complete',
    sortOrder: 10,
    creditCost: null,
    estimatedMinutes: 360,
    unitCount: 1,
    moduleCount: 6,
    lessonCount: 6,
    recordedLessonCount: 6,
    inProductionLessonCount: 0,
    quizCount: 6,
    finalTestCount: 1,
    projectIncluded: true,
    certificateEligible: true,
    status: 'available',
    featuredRank: 1,
    prerequisiteNote:
      'No prior blockchain experience is required. This course is the recommended starting point for learners new to blockchain or digital ownership.',
      learningFocus: [
        {
            label: 'Understand',
            title: 'Blockchain fundamentals',
            description:
            'Learn decentralization, transparency, immutability, wallets, keys, transactions, and digital ownership in practical terms.',
            icon: 'sparkles',
            color: 'cyan',
        },
        {
            label: 'Protect',
            title: 'Your digital access',
            description:
            'Build safer habits around private keys, wallet recovery, transaction verification, phishing awareness, and security decisions.',
            icon: 'shield',
            color: 'blue',
        },
        {
            label: 'Apply',
            title: 'The ownership mindset',
            description:
            'Connect blockchain knowledge to real opportunities for creating, building, and earning in the digital economy.',
            icon: 'target',
            color: 'emerald',
        },
        ],
        whatYouBuild: [
        'A clear mental model for blockchain, wallets, transactions, and digital ownership.',
        'A personal wallet and key-security plan that supports safer participation.',
        'A community-focused blockchain opportunity analysis.',
        'A Personal Blockchain Opportunity Plan that identifies a practical next step.',
        ],
    accent: {
      primary: '#22D3EE',
      secondary: '#2563EB',
    },
    resources: {
      teacherGuide: true,
      studentBook: true,
      activityBook: true,
    },
    units: [
      {
        id: 'blockchain-basics-unit',
        slug: 'blockchain-basics-unit',
        order: 1,
        title: 'Blockchain Basics',
        tagline: 'Create the foundation.',
        description:
          'Learn the core concepts and safer practices needed to understand blockchain, digital ownership, and practical participation in the MetaWork ecosystem.',
        estimatedMinutes: 360,
        lessonCount: 6,
        recordedLessonCount: 6,
        quizCount: 6,
        finalTestIncluded: true,
        projectTitle: 'Personal Blockchain Opportunity Plan',
        resources: {
          teacherGuide: true,
          studentBook: true,
          activityBook: true,
        },
        lessons: [
          {
            order: 1,
            slug: 'introduction-to-blockchain',
            title: 'Introduction to Blockchain',
            description:
              'Learn decentralization, transparency, immutability, and how blockchain supports trustworthy digital systems.',
            youtubeId: '2gFEu2K1O7c',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Distributed Ledger Simulation',
              'Blockchain Features Matching Game',
              'Community Financial Challenge',
            ],
          },
          {
            order: 2,
            slug: 'wallets-and-keys',
            title: 'Wallets and Keys',
            description:
              'Understand wallet functionality, public and private keys, recovery methods, and safer wallet-security habits.',
            youtubeId: 'sDpBksSF8MI',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Public and Private Key Visualization',
              'Wallet Security Checklist',
              'Secure the Keys! Activity',
            ],
          },
          {
            order: 3,
            slug: 'transactions-and-gas-fees',
            title: 'Transactions and Gas Fees',
            description:
              'Learn how blockchain transactions are processed, why fees exist, and how different transaction workflows operate.',
            youtubeId: 'GlshKcIsVN4',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Transaction Flowchart Creator',
              'Gas Fee Calculator',
              'Chain Race Comparison Activity',
            ],
          },
          {
            order: 4,
            slug: 'nfts-and-digital-ownership',
            title: 'NFTs and Digital Ownership',
            description:
              'Explore NFTs, creative ownership, intellectual property, licensing concepts, and the role of digital assets.',
            youtubeId: 'DpuiglMuufI',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'NFT Metadata Template',
              'IP Protection Strategy Planner',
              'Creator’s Market Activity',
            ],
          },
          {
            order: 5,
            slug: 'blockchain-security',
            title: 'Blockchain Security',
            description:
              'Practice safer wallet habits, key protection, transaction verification, and recognition of common security threats.',
            youtubeId: 'AMo5gPmtJV8',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Security Threat Analysis',
              'Security Checklist Creator',
              'Blockchain Defenders Simulation',
            ],
          },
          {
            order: 6,
            slug: 'blockchain-create-build-earn',
            title: 'Blockchain for Creating, Building & Earning',
            description:
              'Connect blockchain concepts to practical opportunities for creators, builders, and participants in the MetaWork ecosystem.',
            youtubeId: 'k7GO-laGIVQ',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            projectIncluded: true,
            activities: [
              'Income Path Planner',
              'Tokenized Revenue Stream Designer',
              'Blockchain Ventures Activity',
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'design-ip-creation',
    slug: 'design-ip-creation',
    title: 'Design & IP Creation',
    subtitle: 'Build your digital asset portfolio.',
    shortDescription:
      'A practical six-lesson course for creating marketable digital assets, preparing IP, building products, and making foundational pricing decisions.',
    description:
      'Design & IP Creation guides learners from a first concept to practical digital assets and product-ready work. Students use accessible design tools, explore intellectual property and licensing concepts, prepare designs for MetaWork workflows, and make foundational pricing decisions.',
    audience: ['students', 'educators', 'creators'],
    topics: [
      'design',
      'ip-licensing',
      'product-development',
      'digital-ownership',
      'creator-commerce',
      'pricing',
    ],
    level: 'beginner',
    enrollmentType: 'approval',
    access: 'school-partner',
    publishStatus: 'published',
    productionStatus: 'complete',
    sortOrder: 20,
    creditCost: null,
    estimatedMinutes: 360,
    unitCount: 1,
    moduleCount: 6,
    lessonCount: 6,
    recordedLessonCount: 6,
    inProductionLessonCount: 0,
    quizCount: 6,
    finalTestCount: 1,
    projectIncluded: true,
    certificateEligible: true,
    status: 'available',
    featuredRank: 2,
    prerequisiteNote:
      'No blockchain course is required to learn the design skills. Blockchain Basics is recommended before any live wallet, IP registration, or on-platform ownership activity.',
      learningFocus: [
        {
            label: 'Design',
            title: 'Marketable digital assets',
            description:
            'Use design thinking, Canva, GIMP, layers, transparency, and practical export workflows to create useful visual assets.',
            icon: 'palette',
            color: 'cyan',
        },
        {
            label: 'Own',
            title: 'Creative work and IP',
            description:
            'Prepare original work with clear metadata, documentation, IP-protection thinking, and licensing-model awareness.',
            icon: 'shield',
            color: 'blue',
        },
        {
            label: 'Build',
            title: 'Product-ready work',
            description:
            'Apply designs to product concepts, explore variations, and use market research to make more confident pricing decisions.',
            icon: 'layers',
            color: 'emerald',
        },
        ],
        whatYouBuild: [
        'A professional logo or graphic designed with marketability and versatility in mind.',
        'Refined digital assets using layers, transparency, and appropriate file formats.',
        'A metadata and documentation package for original creative work.',
        'A product concept and foundational pricing strategy.',
        ],
    accent: {
      primary: '#2563EB',
      secondary: '#22D3EE',
    },
    resources: {
      teacherGuide: true,
      studentBook: true,
      activityBook: true,
    },
    units: [
      {
        id: 'design-ip-creation-unit',
        slug: 'design-ip-creation-unit',
        order: 1,
        title: 'Design & IP Creation',
        tagline: 'Build your digital asset portfolio.',
        description:
          'Create useful digital assets, explore IP and licensing concepts, develop products, and build practical pricing confidence.',
        estimatedMinutes: 360,
        lessonCount: 6,
        recordedLessonCount: 6,
        quizCount: 6,
        finalTestIncluded: true,
        projectTitle: 'Digital Asset Portfolio Project',
        resources: {
          teacherGuide: true,
          studentBook: true,
          activityBook: true,
        },
        lessons: [
          {
            order: 1,
            slug: 'design-thinking-and-canva-basics',
            title: 'Design Thinking & Canva Basics',
            description:
              'Use design thinking and practical visual-design principles to create a marketable logo or graphic with accessible tools.',
            youtubeId: 'dXgDeXdgXwY',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Design Thinking Worksheet',
              'Canva Feature Scavenger Hunt',
              'Logo Design Challenge',
            ],
          },
          {
            order: 2,
            slug: 'gimp-for-advanced-editing',
            title: 'GIMP for Advanced Editing',
            description:
              'Learn layers, selections, transparency, editing workflows, and export choices for higher-quality digital assets.',
            youtubeId: 'qjYCc5ZYDdA',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'GIMP Interface Labeling',
              'Layer Management Practice',
              'File Format Decision Tree',
            ],
          },
          {
            order: 3,
            slug: 'from-design-to-ip',
            title: 'From Design to IP',
            description:
              'Prepare original designs for IP workflows by developing useful metadata, organizing source files, and considering protection strategies.',
            youtubeId: 'Fzina99zCcs',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Metadata Creation Worksheet',
              'IP Preparation Checklist',
              'Design Documentation Activity',
            ],
          },
          {
            order: 4,
            slug: 'ip-licensing-models',
            title: 'IP Licensing Models',
            description:
              'Compare licensing approaches, understand usage rights, and consider how licensing decisions affect value and opportunity.',
            youtubeId: 't5AWIA3yClo',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'License Comparison Exercise',
              'Royalty Strategy Activity',
              'Usage Rights Scenario Review',
            ],
          },
          {
            order: 5,
            slug: 'metawork-product-tool',
            title: 'MetaWork Product Tool',
            description:
              'Apply designs to products, explore variations and collections, and prepare product concepts for a storefront or project presentation.',
            youtubeId: 'TAnasWAWiEc',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Product Concept Builder',
              'Product Variation Planner',
              'Product Presentation Review',
            ],
          },
          {
            order: 6,
            slug: 'pricing-strategy',
            title: 'Pricing Strategy',
            description:
              'Use market research, production-cost thinking, and value considerations to build a practical pricing approach.',
            youtubeId: 'kx4XPW6S7Dg',
            status: 'recorded',
            productionStatus: 'recorded',
            quizIncluded: true,
            homeworkIncluded: true,
            projectIncluded: true,
            activities: [
              'Market Research Worksheet',
              'Cost and Margin Exercise',
              'Pricing Strategy Challenge',
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'sales-client-acquisition',
    slug: 'sales-client-acquisition',
    title: 'Sales & Client Acquisition',
    subtitle: 'Earn by bringing your work to market.',
    shortDescription:
      'A six-lesson course on product listings, marketing, client research, outreach, sales conversations, revenue tracking, and reinvestment.',
    description:
      'Sales & Client Acquisition helps learners bring digital assets and product concepts to market. Students build product listings, marketing plans, prospect lists, outreach materials, sales confidence, and practical systems for tracking and reinvesting revenue.',
    audience: ['students', 'educators', 'creators'],
    topics: [
      'sales-marketing',
      'creator-commerce',
      'product-development',
      'entrepreneurship',
      'client-acquisition',
      'revenue-sharing',
    ],
    level: 'intermediate',
    enrollmentType: 'approval',
    access: 'school-partner',
    publishStatus: 'published',
    productionStatus: 'in-production',
    sortOrder: 30,
    creditCost: null,
    estimatedMinutes: 360,
    unitCount: 1,
    moduleCount: 6,
    lessonCount: 6,
    recordedLessonCount: 0,
    inProductionLessonCount: 6,
    quizCount: 6,
    finalTestCount: 1,
    projectIncluded: true,
    certificateEligible: true,
    status: 'in-production',
    featuredRank: 3,
    prerequisiteNote:
      'Works best when learners already have a product, design, service, or project to bring to market. Design & IP Creation is helpful but not required if a cohort brings its own project concept.',
      learningFocus: [
        {
            label: 'Position',
            title: 'A product for the market',
            description:
            'Build stronger product listings, improve discoverability, set practical prices, and communicate value clearly.',
            icon: 'store',
            color: 'cyan',
        },
        {
            label: 'Reach',
            title: 'The right customers',
            description:
            'Develop customer personas, marketing content, social strategy, prospect research, and a focused outreach approach.',
            icon: 'users',
            color: 'blue',
        },
        {
            label: 'Grow',
            title: 'Sustainable sales systems',
            description:
            'Practice proposals, negotiations, client relationships, revenue tracking, and reinvestment decision-making.',
            icon: 'chart',
            color: 'emerald',
        },
        ],
        whatYouBuild: [
        'A complete direct-to-consumer product listing with price, copy, images, categories, and tags.',
        'A customer persona, marketing plan, content calendar, and platform-specific promotional materials.',
        'A prioritized wholesale prospect list, outreach email, and proposal framework.',
        'A revenue-tracking and reinvestment plan for continued growth.',
        ],
    accent: {
      primary: '#34D399',
      secondary: '#22D3EE',
    },
    resources: {
      teacherGuide: true,
      studentBook: true,
      activityBook: true,
    },
    units: [
      {
        id: 'sales-client-acquisition-unit',
        slug: 'sales-client-acquisition-unit',
        order: 1,
        title: 'Sales & Client Acquisition',
        tagline: 'Earn by bringing your work to market.',
        description:
          'Build listing, marketing, outreach, sales, and revenue-management skills that help turn projects into market opportunities.',
        estimatedMinutes: 360,
        lessonCount: 6,
        recordedLessonCount: 0,
        quizCount: 6,
        finalTestIncluded: true,
        projectTitle: 'Sustainable Income Channel Plan',
        resources: {
          teacherGuide: true,
          studentBook: true,
          activityBook: true,
        },
        lessons: [
          {
            order: 1,
            slug: 'direct-to-consumer-product-listing',
            title: 'Direct-to-Consumer Product Listing',
            description:
              'Build a clear product listing with an effective title, description, imagery, price, categories, and discoverability details.',
            youtubeId: null,
            status: 'in-production',
            productionStatus: 'in-production',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Product Listing Checklist',
              'Product Description Template',
              'Competitive Analysis Worksheet',
            ],
          },
          {
            order: 2,
            slug: 'marketing-your-product',
            title: 'Marketing Your Product',
            description:
              'Develop customer personas, platform-appropriate content, hashtags, and a practical marketing plan.',
            youtubeId: null,
            status: 'in-production',
            productionStatus: 'in-production',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Customer Persona Development',
              'Marketing Content Planner',
              'Content Calendar Builder',
            ],
          },
          {
            order: 3,
            slug: 'finding-wholesale-clients',
            title: 'Finding Wholesale Clients',
            description:
              'Research potential clients, evaluate fit, build a prospect list, and prioritize outreach opportunities.',
            youtubeId: null,
            status: 'in-production',
            productionStatus: 'in-production',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Client Fit Evaluation',
              'Prospect Database Builder',
              'Outreach Priority Matrix',
            ],
          },
          {
            order: 4,
            slug: 'outreach-and-proposal-writing',
            title: 'Outreach & Proposal Writing',
            description:
              'Write personalized outreach, prepare a practical proposal, and build a thoughtful follow-up approach.',
            youtubeId: null,
            status: 'in-production',
            productionStatus: 'in-production',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Outreach Email Builder',
              'Proposal Outline',
              'Follow-Up Sequence Planner',
            ],
          },
          {
            order: 5,
            slug: 'closing-a-wholesale-deal',
            title: 'Closing a Wholesale Deal',
            description:
              'Prepare for negotiation, handle common questions, clarify expectations, and build stronger client relationships.',
            youtubeId: null,
            status: 'in-production',
            productionStatus: 'in-production',
            quizIncluded: true,
            homeworkIncluded: true,
            activities: [
              'Negotiation Scenario Practice',
              'Objection-Handling Exercise',
              'Agreement Review Checklist',
            ],
          },
          {
            order: 6,
            slug: 'revenue-tracking-and-reinvestment',
            title: 'Revenue Tracking & Reinvestment',
            description:
              'Track sales performance, review results, plan reinvestment, and build toward sustainable income channels.',
            youtubeId: null,
            status: 'in-production',
            productionStatus: 'in-production',
            quizIncluded: true,
            homeworkIncluded: true,
            projectIncluded: true,
            activities: [
              'Revenue Tracking Dashboard',
              'Reinvestment Strategy Planner',
              'Sustainable Income Channel Plan',
            ],
          },
        ],
      },
    ],
  },
];

export const ACADEMY_CURRICULUM_PATHWAYS = [
  {
    id: 'metamanufacturing-create-build-earn',
    slug: 'metamanufacturing-create-build-earn',
    title: 'MetaManufacturing: Create. Build. Earn.',
    shortDescription:
      'A complete 18-lesson entrepreneurship and digital-commerce pathway built from three standalone Academy courses.',
    description:
      'The MetaManufacturing pathway connects Blockchain Basics, Design & IP Creation, and Sales & Client Acquisition into one complete progression. Schools can start with one course, combine two, or build toward the full Create. Build. Earn. program.',
    courseSlugs: [
      'blockchain-basics',
      'design-ip-creation',
      'sales-client-acquisition',
    ],
    estimatedMinutes: 1080,
    lessonCount: 18,
    recordedLessonCount: 12,
    inProductionLessonCount: 6,

    access: 'school-partner',
    publishStatus: 'draft',
    productionStatus: 'in-production',
    sortOrder: 10,

    accent: {
      primary: '#22D3EE',
      secondary: '#34D399',
    },
  },
];

export function getAcademyCourseBySlug(slug) {
  return ACADEMY_COURSES.find((course) => course.slug === slug);
}

export function getAcademyCurriculumPathwayBySlug(slug) {
  return ACADEMY_CURRICULUM_PATHWAYS.find(
    (pathway) => pathway.slug === slug
  );
}

export function getFeaturedCourses(limit = 3) {
  return ACADEMY_COURSES.filter((course) => course.featuredRank)
    .sort((first, second) => first.featuredRank - second.featuredRank)
    .slice(0, limit);
}

export function getPublishedAcademyCourses() {
  return ACADEMY_COURSES.filter(
    (course) => course.publishStatus === 'published'
  ).sort((first, second) => first.sortOrder - second.sortOrder);
}