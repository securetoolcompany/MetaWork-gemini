// Creator Profile Mock Data

export const profileThemes = [
  {
    id: 'tell-my-story',
    name: 'Tell My Story',
    description: 'Share your journey and personal narrative',
    layout: 'timeline',
    defaultColor: '#3b82f6',
    features: ['Timeline', 'Photo Gallery', 'Video Bio', 'Milestones']
  },
  {
    id: 'show-my-cause',
    name: 'Show My Cause',
    description: 'Advocate for what matters to you',
    layout: 'impact',
    defaultColor: '#10b981',
    features: ['Mission Statement', 'Impact Metrics', 'Call to Action', 'Donation Links']
  },
  {
    id: 'open-for-work',
    name: 'Open for Work',
    description: 'Professional portfolio and hire me page',
    layout: 'portfolio',
    defaultColor: '#8b5cf6',
    features: ['Portfolio Grid', 'Skills', 'Testimonials', 'Contact Form']
  },
  {
    id: 'showcase-gallery',
    name: 'Showcase Gallery',
    description: 'Display your creative work beautifully',
    layout: 'gallery',
    defaultColor: '#f59e0b',
    features: ['Masonry Gallery', 'Lightbox', 'Categories', 'Featured Work']
  },
  {
    id: 'brand-ambassador',
    name: 'Brand Ambassador',
    description: 'Influencer and brand partnership page',
    layout: 'influencer',
    defaultColor: '#ec4899',
    features: ['Stats Dashboard', 'Brand Deals', 'Media Kit', 'Collaborations']
  },
];

export const creatorProfiles = [
  {
    username: 'rogue-combat-club',
    theme: 'tell-my-story',
    accentColor: '#3b82f6',
    
    // Basic Info
    displayName: 'Rogue Combat Club',
    tagline: 'Martial Arts Training & Lifestyle Brand',
    bio: `Founded in 2018, Rogue Combat Club has become a leading destination for martial arts enthusiasts. 
    
We believe in the transformative power of combat sports - building not just physical strength, but mental resilience and community. Our designs reflect the warrior spirit in all of us.
    
From MMA to boxing, kickboxing to jiu-jitsu, we celebrate all disciplines and welcome fighters of all levels.`,
    
    country: 'United States',
    countryCode: 'US',
    location: 'Los Angeles, CA',
    
    // Contact
    email: 'contact@roguecombatclub.com',
    phone: '+1 (555) 123-4567',
    website: 'https://roguecombatclub.com',
    
    // Social Media
    socials: {
      twitter: 'https://twitter.com/roguecombat',
      instagram: 'https://instagram.com/roguecombat',
      youtube: 'https://youtube.com/@roguecombat',
      tiktok: 'https://tiktok.com/@roguecombat',
      facebook: 'https://facebook.com/roguecombat',
      linkedin: null,
    },
    
    // Media
    heroMedia: {
      type: 'video',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Would be real YouTube embed
      posterImage: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=600&fit=crop',
    },
    
    gallery: [
      {
        id: 1,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=600&fit=crop',
        caption: 'Training Session 2024',
      },
      {
        id: 2,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&h=600&fit=crop',
        caption: 'Championship Fight',
      },
      {
        id: 3,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1583473848882-f9a5bc7fd2ee?w=800&h=600&fit=crop',
        caption: 'Community Event',
      },
      {
        id: 4,
        type: 'video',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnail: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&h=600&fit=crop',
        caption: 'Training Highlights',
      },
    ],
    
    milestones: [
      {
        year: '2018',
        title: 'Founded Rogue Combat Club',
        description: 'Started with a vision to create premium martial arts apparel',
      },
      {
        year: '2020',
        title: 'First Championship Sponsorship',
        description: 'Sponsored our first professional fighter',
      },
      {
        year: '2022',
        title: '10,000 Members Strong',
        description: 'Reached 10,000 community members worldwide',
      },
      {
        year: '2024',
        title: 'Launched IP Marketplace',
        description: 'Joined MetaWork to empower creators',
      },
    ],
    
    // Monetization
    profileAds: {
      enabled: true,
      headerAd: true,
      sidebarAd: true,
      inContentAd: true,
    },
    
    tipJar: {
      enabled: true,
      title: 'Support Our Mission',
      description: 'Help us grow the community and create more amazing content',
      presets: [5, 10, 25, 50],
      wallet: '0x742d35f8a9b3c2e1',
    },
  },
  {
    username: 'urban-artists',
    theme: 'showcase-gallery',
    accentColor: '#f59e0b',
    
    displayName: 'Urban Artists Collective',
    tagline: 'Street Art & Urban Culture',
    bio: `We are a collective of street artists, muralists, and urban designers passionate about bringing art to the streets.
    
Our mission is to transform public spaces and give voice to underrepresented communities through bold, vibrant art.
    
Every design tells a story. Every piece makes a statement.`,
    
    country: 'United Kingdom',
    countryCode: 'GB',
    location: 'London, UK',
    
    email: 'hello@urbanartists.co.uk',
    phone: null,
    website: 'https://urbanartists.co.uk',
    
    socials: {
      twitter: 'https://twitter.com/urbanartists',
      instagram: 'https://instagram.com/urbanartists',
      youtube: null,
      tiktok: 'https://tiktok.com/@urbanartists',
      facebook: 'https://facebook.com/urbanartists',
      linkedin: null,
    },
    
    heroMedia: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1200&h=600&fit=crop',
    },
    
    gallery: [
      {
        id: 1,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=600&fit=crop',
        caption: 'Downtown Mural Project',
      },
      {
        id: 2,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&h=600&fit=crop',
        caption: 'Abstract Collection',
      },
      {
        id: 3,
        type: 'image',
        url: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&h=600&fit=crop',
        caption: 'Street Art Festival',
      },
    ],
    
    profileAds: {
      enabled: true,
      headerAd: true,
      sidebarAd: false,
      inContentAd: true,
    },
    
    tipJar: {
      enabled: true,
      title: 'Support Independent Artists',
      description: 'Your support helps us create more public art',
      presets: [10, 25, 50],
      wallet: '0x8a9b4c5d6e7f8g9h',
    },
  },
  {
    username: 'tech-esports',
    theme: 'brand-ambassador',
    accentColor: '#8b5cf6',
    
    displayName: 'Tech eSports',
    tagline: 'Professional Gaming & eSports Organization',
    bio: `Tech eSports is a premier gaming organization competing at the highest levels across multiple titles.
    
We're building the future of competitive gaming through player development, content creation, and community engagement.
    
Join us on our journey to championship glory!`,
    
    country: 'South Korea',
    countryCode: 'KR',
    location: 'Seoul, South Korea',
    
    email: 'contact@techesports.gg',
    phone: null,
    website: 'https://techesports.gg',
    
    socials: {
      twitter: 'https://twitter.com/techesports',
      instagram: 'https://instagram.com/techesports',
      youtube: 'https://youtube.com/@techesports',
      tiktok: 'https://tiktok.com/@techesports',
      facebook: null,
      linkedin: 'https://linkedin.com/company/techesports',
    },
    
    heroMedia: {
      type: 'video',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      posterImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=600&fit=crop',
    },
    
    stats: [
      { label: 'Tournament Wins', value: '47' },
      { label: 'Prize Money', value: '$2.4M' },
      { label: 'Team Members', value: '28' },
      { label: 'Fan Base', value: '850K' },
    ],
    
    achievements: [
      'World Championship 2023',
      'Regional Champions (3x)',
      'Best New Team Award',
      'Content Creator of the Year',
    ],
    
    profileAds: {
      enabled: true,
      headerAd: true,
      sidebarAd: true,
      inContentAd: false,
    },
    
    tipJar: {
      enabled: true,
      title: 'Support Our Team',
      description: 'Help us compete at the highest level',
      presets: [10, 25, 50, 100],
      wallet: '0x9c8d7e6f5a4b3c2d',
    },
  },
];
