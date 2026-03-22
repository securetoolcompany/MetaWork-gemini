# MetaWork Creator Hub

## Overview
A modern Web3 creator platform built with Next.js 14, featuring a dark professional interface with electric blue and purple accents. This application allows creators to upload their intellectual property (IP), design custom products, and earn from their creations.

## Technical Stack
- **Framework**: Next.js 14.2.3 with App Router
- **Frontend**: React 18, Tailwind CSS, shadcn/ui components
- **Database**: MongoDB (optional, app works with mock data)
- **Blockchain**: Algorand integration (Pera Wallet)
- **Package Manager**: Yarn

## Project Structure
```
/app                    # Next.js App Router pages
  /admin               # Admin dashboard pages
  /aisle               # Creator aisle/storefront pages
  /api                 # API routes
  /showroom            # Product marketplace
  /vault               # Revenue vault pages
/components            # React components
  /ui                  # shadcn/ui component library
  /layout              # Header, Sidebar
  /designer            # Product designer components
/contracts             # Algorand smart contracts (PyTeal)
/lib                   # Utilities and context providers
/hooks                 # Custom React hooks
```

## Development
- **Dev Server**: `yarn dev` on port 5000
- **Build**: `yarn build`
- **Start**: `yarn start`

## Environment Variables
- `MONGO_URL`: MongoDB connection string (optional, falls back to mock data)
- `DB_NAME`: Database name (default: metawork_db)
- `JWT_SECRET`: JWT signing secret (for authentication)
- `CORS_ORIGINS`: Allowed CORS origins

## Key Features
- Dashboard with earnings and sales metrics
- IP asset management and upload
- Product designer with drag-drop canvas
- Creator storefronts (Aisles)
- Showroom/marketplace
- Revenue pools and vaults (Algorand)
- Admin panel for platform management

## Recent Changes
- December 28, 2025: Initial import to Replit, configured for port 5000
