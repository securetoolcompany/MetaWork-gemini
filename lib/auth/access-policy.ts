const protectedRoutes = [
  '/dashboard',
  '/products/creator',
  '/aisle-settings',
  '/my-products',
  '/my-ip',
  '/upload-ip',
  '/earnings',
  '/sales',
  '/promotions',
  '/profile-settings',
  '/account-management',
  '/deploy-contract',
  '/claim',
  '/admin',
  '/tokenized-funds/nillion/nodes',
];

export function requiresAccount(pathname: string): boolean {
  if (
    protectedRoutes.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`)
    )
  ) {
    return true;
  }

  return /^\/products\/[^/]+\/manage(?:\/|$)/.test(pathname);
}

export function getAccountGateCopy(pathname: string) {
  if (
    pathname === '/products/creator' ||
    pathname.startsWith('/products/creator/')
  ) {
    return {
      title: 'Your next product starts here.',
      description:
        'Create a free account to design products, save your work, and publish to your own Aisle.',
    };
  }

  if (
    pathname === '/aisle-settings' ||
    pathname.startsWith('/aisle-settings/')
  ) {
    return {
      title: 'Your creator storefront starts here.',
      description:
        'Create a free account to build your Aisle, publish products, and manage your collection.',
    };
  }

  return {
    title: 'Make it yours with a free account.',
    description:
      'Sign in or create an account to access your workspace, manage your assets, and track your activity.',
  };
}