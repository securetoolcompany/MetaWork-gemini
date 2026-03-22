// Aisle Settings Tutorial Definitions

// Tutorial 1: Theme & Branding (8 steps)
export const aisleThemeTutorial = [
  {
    step: 1,
    title: '🎨 Welcome to Theme Customization!',
    description: 'Let\'s customize your Aisle\'s look! We\'ll start with theme presets. Click on any preset below to see your Aisle transform instantly!',
    targetSelector: '[data-tutorial="theme-presets"]',
    position: 'bottom',
    highlightPadding: 15
  },
  {
    step: 2,
    title: 'Pick Your Accent Color',
    description: 'Now select an accent color that matches your brand. This color will be used for buttons, links, and highlights. Click the color picker to choose your perfect shade!',
    targetSelector: '[data-tutorial="accent-color"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 3,
    title: 'Upload Your Banner (Optional)',
    description: 'Add a banner image to make your Aisle stand out! This appears at the top of your page. You can drag & drop an image or click to upload. Skip if you want to add this later.',
    targetSelector: '[data-tutorial="banner-upload"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 4,
    title: 'Add Your Logo (Optional)',
    description: 'Upload your logo to build brand recognition. This will appear in your Aisle header. Recommended size: 200x200px. You can skip this for now and add it later.',
    targetSelector: '[data-tutorial="logo-upload"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 5,
    title: 'Write Your Bio',
    description: 'Tell visitors who you are! Write a compelling bio (up to 300 characters) that describes your work and style. This helps customers connect with you.',
    targetSelector: '[data-tutorial="bio-text"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 6,
    title: 'Connect Your Social Media',
    description: 'Add links to your Twitter, Instagram, TikTok, or website. Social links help build trust and let customers follow you on other platforms.',
    targetSelector: '[data-tutorial="social-links"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 7,
    title: '✨ Theme Complete! Don\'t Forget to Save',
    description: 'You\'ve customized your Aisle\'s branding! Notice the "Save Changes" button at the bottom lights up when you make changes. Click it to save your settings. Click "Complete" below to finish this tutorial!',
    targetSelector: null,
    position: 'center',
    highlightPadding: 20
  }
];

// Tutorial 2: Collections (9 steps)
export const aisleCollectionsTutorial = [
  {
    step: 1,
    title: '📦 Organize Products with Collections',
    description: 'Collections help you group related products together. For example: "Summer Collection", "Best Sellers", or "Limited Edition". Let\'s create your first collection!',
    targetSelector: '[data-tutorial="collections-tab"]',
    position: 'bottom'
  },
  {
    step: 2,
    title: 'Click to Create Collection',
    description: 'Now click the "Create Collection" button below to open the creation dialog. Go ahead, click it!',
    targetSelector: '[data-tutorial="create-collection"]',
    position: 'right',
    highlightPadding: 15,
    hideNextButton: true
  },
  {
    step: 3,
    title: 'Name Your Collection',
    description: 'Give your collection a catchy name! Examples: "Best Sellers", "Summer Vibes", "Limited Edition", "New Arrivals". Make it descriptive and appealing to customers.',
    targetSelector: '[data-tutorial="collection-name"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 4,
    title: 'Add a Description (Optional)',
    description: 'Describe what makes this collection special. This helps customers understand what they\'ll find here. You can skip this if you prefer to keep it simple.',
    targetSelector: '[data-tutorial="collection-description"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 5,
    title: 'Choose Products Per Row',
    description: 'Decide how many products display side-by-side in this collection. 2 = Large cards, 3 = Medium, 4 = Compact. Try different options and watch the preview!',
    targetSelector: '[data-tutorial="products-per-row"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 6,
    title: 'Add Products to Collection',
    description: 'Click here to add products to your collection. You can select multiple products at once using checkboxes. Products can appear in multiple collections!',
    targetSelector: '[data-tutorial="add-products"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 7,
    title: 'Reorder Collections',
    description: 'Drag collections up and down to change their order on your Aisle. Put your most important collections at the top where visitors will see them first.',
    targetSelector: '[data-tutorial="collection-card"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 8,
    title: 'Duplicate or Delete',
    description: 'Duplicate a collection to create a similar one quickly, or delete collections you no longer need. Your products won\'t be deleted, just removed from the collection.',
    targetSelector: '[data-tutorial="collection-actions"]',
    position: 'left',
    highlightPadding: 15
  },
  {
    step: 9,
    title: '🎉 Collections Mastered!',
    description: 'You now know how to organize your products into collections! This makes browsing easier for customers and can increase sales. Click "Complete" to finish!',
    targetSelector: null,
    position: 'center',
    highlightPadding: 20
  }
];

// Tutorial 3: Layout & Display (7 steps)
export const aisleLayoutTutorial = [
  {
    step: 1,
    title: '🎭 Customize Your Aisle Layout',
    description: 'Control how your Aisle looks and feels with layout options. From product card styles to header designs, you have full control over the visual presentation.',
    targetSelector: '[data-tutorial="layout-tab"]',
    position: 'bottom'
  },
  {
    step: 2,
    title: 'Set Global Products Per Row',
    description: 'This sets the default number of products shown side-by-side across ALL collections. 2 = Big & bold, 3 = Balanced, 4 = Maximum products visible. Watch the preview!',
    targetSelector: '[data-tutorial="global-products-row"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 3,
    title: 'Choose Your Card Style',
    description: 'Pick how product cards look: Minimal (clean), Standard (balanced), or Detailed (shows more info). Each style affects how much product information is displayed.',
    targetSelector: '[data-tutorial="card-style"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 4,
    title: 'Select Header Style',
    description: 'Choose your Aisle header layout: Full Banner (dramatic), Compact (efficient), or Minimal (clean). This affects how your banner and profile info are displayed.',
    targetSelector: '[data-tutorial="header-style"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 5,
    title: 'Set Default Product Sorting',
    description: 'Decide how products are ordered by default: Newest First, Best Selling, Price (Low to High), or Price (High to Low). Customers can still change this.',
    targetSelector: '[data-tutorial="default-sorting"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 6,
    title: 'Toggle Visibility Options',
    description: 'Control what information appears on your Aisle: "Powered by MetaWork" badge, reviews, and sales counter. Turn these on/off based on your preference.',
    targetSelector: '[data-tutorial="visibility-toggles"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 7,
    title: '✅ Layout Perfected!',
    description: 'You\'ve mastered Aisle layouts! Your storefront now looks exactly how you want it. Check the live preview to see all your changes. Click "Complete" to finish!',
    targetSelector: null,
    position: 'center',
    highlightPadding: 20
  }
];

// Tutorial 4: Revenue Settings (10 steps)
export const aisleRevenueTutorial = [
  {
    step: 1,
    title: '💰 Maximize Your Earnings!',
    description: 'Beyond product sales, you can earn through ads and tips! Let\'s set up additional revenue streams. You earn money while keeping full creative control.',
    targetSelector: '[data-tutorial="revenue-tab"]',
    position: 'bottom'
  },
  {
    step: 2,
    title: 'Understanding Ad Placements',
    description: 'MetaWork shows non-intrusive ads on your Aisle and shares 70% of revenue with YOU. There are 3 placement types: Header Banner, Sidebar, and In-Grid. Let\'s enable them!',
    targetSelector: '[data-tutorial="ad-placements"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 3,
    title: 'Enable Header Banner Ads',
    description: 'Toggle this ON to show a banner ad at the top of your Aisle. It\'s the most visible placement and typically earns the most. Estimated: $0.15-0.30 per 1000 views.',
    targetSelector: '[data-tutorial="header-ad-toggle"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 4,
    title: 'Enable Sidebar Ads (Optional)',
    description: 'Sidebar ads appear on the right side (desktop only). They\'re less intrusive but still earn revenue. Estimated: $0.10-0.20 per 1000 views.',
    targetSelector: '[data-tutorial="sidebar-ad-toggle"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 5,
    title: 'Enable In-Grid Ads (Blend Seamlessly)',
    description: 'These ads blend into your product grid, appearing between products. Very natural and non-disruptive. Estimated: $0.08-0.15 per 1000 views.',
    targetSelector: '[data-tutorial="grid-ad-toggle"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 6,
    title: 'Adjust Ad Frequency',
    description: 'Control how often in-grid ads appear (every X products). Lower = More ads & revenue but busier layout. Higher = Cleaner look but less ad revenue. Find your balance!',
    targetSelector: '[data-tutorial="ad-frequency"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 7,
    title: '🎁 Enable the Tip Jar!',
    description: 'Let fans support you directly! Enable the Tip Jar to receive tips from customers who love your work. It\'s a great way to build community and earn extra income.',
    targetSelector: '[data-tutorial="tip-jar-toggle"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 8,
    title: 'Connect Your Wallet for Tips',
    description: 'Tips are paid directly to your crypto wallet (Algorand). Connect your wallet address here so you can receive tips. You\'ll get notifications when someone tips you!',
    targetSelector: '[data-tutorial="tip-wallet"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 9,
    title: 'Set Tip Preset Amounts',
    description: 'Make it easy for fans to tip you! Set 3 quick-tip amounts (e.g., $3, $5, $10). Supporters can also enter custom amounts.',
    targetSelector: '[data-tutorial="tip-presets"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 10,
    title: 'Customize Button Text',
    description: 'Personalize your tip button! Change the text to match your style. Examples: "Buy Me a Coffee", "Support My Work", "Tip the Creator". Make it personal!',
    targetSelector: '[data-tutorial="tip-button-text"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 11,
    title: 'Choose Button Placement',
    description: 'Decide where the tip button appears: In your profile header, as a floating button in the corner, or both! Pick what works best for your Aisle layout.',
    targetSelector: '[data-tutorial="tip-button-placement"]',
    position: 'right',
    highlightPadding: 15
  },
  {
    step: 12,
    title: '🚀 Revenue Settings Complete!',
    description: 'You\'ve unlocked multiple income streams! Product sales + Ad revenue + Tips = Maximum earnings. Track your ad earnings and tips in the Earnings page. Click "Complete" to finish!',
    targetSelector: null,
    position: 'center',
    highlightPadding: 20
  }
];

// Helper function to get tutorial by ID
export function getAisleTutorial(tutorialId) {
  const tutorials = {
    'aisle-theme': aisleThemeTutorial,
    'aisle-collections': aisleCollectionsTutorial,
    'aisle-layout': aisleLayoutTutorial,
    'aisle-revenue': aisleRevenueTutorial
  };
  return tutorials[tutorialId] || null;
}

// Tutorial metadata for display
export const aisleTutorialMetadata = {
  'aisle-theme': {
    id: 'aisle-theme',
    name: 'Theme & Branding',
    description: 'Learn to customize your Aisle\'s look with themes, colors, and branding.',
    icon: 'Palette',
    color: 'cyan',
    steps: 7,
    route: '/aisle-settings?tab=theme&tutorial=true'
  },
  'aisle-collections': {
    id: 'aisle-collections',
    name: 'Collections Management',
    description: 'Organize products into collections for better customer browsing.',
    icon: 'FolderOpen',
    color: 'indigo',
    steps: 9,
    route: '/aisle-settings?tab=collections&tutorial=true'
  },
  'aisle-layout': {
    id: 'aisle-layout',
    name: 'Layout & Display',
    description: 'Control card styles, header layouts, and visibility options.',
    icon: 'Layout',
    color: 'pink',
    steps: 7,
    route: '/aisle-settings?tab=layout&tutorial=true'
  },
  'aisle-revenue': {
    id: 'aisle-revenue',
    name: 'Revenue Settings',
    description: 'Set up ads and tip jar to maximize your earnings beyond sales.',
    icon: 'DollarSign',
    color: 'emerald',
    steps: 12,
    route: '/aisle-settings?tab=revenue&tutorial=true'
  }
};
