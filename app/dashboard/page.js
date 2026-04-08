'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Palette, Database, Store, Zap, 
  ArrowUpRight, BookOpen, Wallet, Eye, 
  Share2, Activity, ShoppingCart, Globe, 
  TrendingUp, Layout, Cpu, LineChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { useWallet } from '@/lib/WalletContext';

const TickerTape = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "symbols": [
          { "proName": "BINANCE:ALGOUSDT", "title": "ALGO" },
          { "proName": "BINANCE:BTCUSDT", "title": "BTC" },
          { "proName": "BINANCE:ETHUSDT", "title": "ETH" },
          { "proName": "NASDAQ:AAPL", "title": "Apple" },
          { "proName": "NASDAQ:TSLA", "title": "Tesla" }
        ],
        "showSymbolLogo": true, "colorTheme": "dark", "isTransparent": true, "displayMode": "adaptive", "locale": "en"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container mb-6 border-b border-white/5 pb-2" ref={container} />;
};

// --- OPERATIONS WIDGETS ---

// 1. Wallet & Infrastructure Node
const WalletStatusWidget = () => {
  // Mocking your useWallet state
  const isConnected = true;
  const address = "META...7X9Q";
  const algoBalance = "14,250.00";
  const usdcBalance = "105,420.50";

  return (
    <div className="w-full h-full bg-[#131722] text-white p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Active Node</div>
          <div className="text-xl font-mono font-bold text-cyan-400">{address}</div>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Algorand Mainnet</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 mt-4">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Treasury (ALGO)</div>
          <div className="text-lg font-mono">{algoBalance}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Liquidity (USDC)</div>
          <div className="text-lg font-mono text-green-400">${usdcBalance}</div>
        </div>
      </div>
    </div>
  );
};

// 2. IP Asset Ledger (Your inventory.ipAssets)
const IPAssetLedger = () => {
  const ipAssets = [
    { id: "ASA-8821", name: "MetaWork Patent A", class: "Utility IP", status: "Tokenized", value: "$45,000" },
    { id: "ASA-8822", name: "Global License Matrix", class: "Software Reg", status: "Escrow", value: "$120,000" },
    { id: "ASA-8824", name: "Commercial Real Estate Q3", class: "Yield RWA", status: "Tokenized", value: "$850,000" },
    { id: "ASA-8829", name: "Brand Trademark Portfolio", class: "IP Asset", status: "Pending", value: "Evaluating" },
  ];

  return (
    <div className="w-full h-full bg-[#131722] text-white p-6 overflow-y-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-500 uppercase tracking-wider">
            <th className="pb-3 font-medium">Asset ID</th>
            <th className="pb-3 font-medium">IP / RWA Title</th>
            <th className="pb-3 font-medium">Class</th>
            <th className="pb-3 font-medium">Network Status</th>
            <th className="pb-3 font-medium text-right">Valuation</th>
          </tr>
        </thead>
        <tbody>
          {ipAssets.map((asset, idx) => (
            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-4 text-xs font-mono text-cyan-400">{asset.id}</td>
              <td className="py-4 text-sm font-bold">{asset.name}</td>
              <td className="py-4 text-sm text-slate-400">{asset.class}</td>
              <td className="py-4 text-sm">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  asset.status === 'Tokenized' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                  asset.status === 'Escrow' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                  'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  {asset.status}
                </span>
              </td>
              <td className="py-4 text-sm font-mono text-right">{asset.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 3. Live Product Telemetry (Your liveProducts)
const LiveProductsTelemetry = () => {
  const liveProducts = [
    { id: "PRD-01", name: "Fractional License A", minted: 1000, sold: 850, apy: "8.5%" },
    { id: "PRD-02", name: "Commercial Debt Pool", minted: 500, sold: 500, apy: "12.0%" },
    { id: "PRD-03", name: "IP Royalty Stream", minted: 10000, sold: 1200, apy: "5.2%" },
  ];

  return (
    <div className="w-full h-full bg-[#131722] text-white p-6 overflow-y-auto space-y-4">
      {liveProducts.map((prod, idx) => {
        const fillPercentage = (prod.sold / prod.minted) * 100;
        return (
          <div key={idx} className="bg-black/50 border border-white/5 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="font-bold text-sm">{prod.name} <span className="text-[10px] text-slate-500 font-mono ml-2">{prod.id}</span></div>
              <div className="text-xs font-mono text-green-400 border border-green-500/20 bg-green-500/10 px-2 py-1 rounded">YIELD: {prod.apy}</div>
            </div>
            
            {/* Custom Progress Bar for Token Distribution */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div 
                className={`h-full ${fillPercentage === 100 ? 'bg-purple-500' : 'bg-cyan-500'}`} 
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
            
            <div className="flex justify-between text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              <span>Distributed: {prod.sold}</span>
              <span>Total Supply: {prod.minted}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- QUICK ACTIONS / SYSTEM DIRECTIVES ---
const ExecutionDirectives = () => {
  const actions = [
    { 
      title: "Mint New Asset", 
      desc: "Tokenize new IP or RWA", 
      icon: "[+]", 
      color: "text-cyan-400", 
      bgHover: "hover:bg-cyan-950/30", 
      borderHover: "hover:border-cyan-500/50",
      href: "/upload-asset"
    },
    { 
      title: "Create Product", 
      desc: "Initialize creation flow", 
      icon: "[∆]", 
      color: "text-pink-400", 
      bgHover: "hover:bg-pink-950/30", 
      borderHover: "hover:border-pink-500/50",
      href: "/create-product" // <-- Wires directly to your new product flow
    },
    { 
      title: "Deploy Product", 
      desc: "Manage fractional pools", 
      icon: "[⚡]", 
      color: "text-green-400", 
      bgHover: "hover:bg-green-950/30", 
      borderHover: "hover:border-green-500/50",
      href: "/my-products"
    },
    { 
      title: "Platform Academy", 
      desc: "Read MetaWork documentation", 
      icon: "[i]", 
      color: "text-slate-500", 
      bgHover: "hover:bg-slate-900/50", 
      borderHover: "hover:border-slate-500/30",
      isComingSoon: true 
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {actions.map((action, idx) => {
        
        const InnerContent = (
          <>
            <div className={`text-lg font-black mb-2 flex items-center gap-3 ${action.color}`}>
              <span className="font-mono text-sm opacity-50 group-hover:opacity-100 transition-opacity">
                {action.icon}
              </span>
              <span className="uppercase tracking-widest text-xs italic">
                {action.title}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono text-left uppercase tracking-wider">
              {action.desc}
            </div>
            
            {action.isComingSoon && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#131722] border border-white/10 text-slate-300 text-[10px] font-mono uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                System Offline: Coming Soon
              </div>
            )}
          </>
        );

        if (action.isComingSoon) {
          return (
            <button 
              key={idx} 
              className={`relative flex flex-col items-start p-4 bg-black border border-white/5 rounded-lg transition-all duration-200 group cursor-not-allowed ${action.bgHover} ${action.borderHover}`}
              disabled
            >
              {InnerContent}
            </button>
          );
        }

        return (
          <a 
            key={idx} 
            href={action.href}
            className={`relative flex flex-col items-start p-4 bg-black border border-white/10 rounded-lg transition-all duration-200 group cursor-pointer ${action.bgHover} ${action.borderHover} block no-underline`}
          >
            {InnerContent}
          </a>
        );
      })}
    </div>
  );
};

// 2A: Global Interest Rates (Bonds)
const BondsWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "dateRange": "12M",
        "showChart": false,
        "locale": "en",
        "width": "100%",
        "height": "100%",
        "tabs": [{
          "title": "Government Bonds",
          "symbols": [
            { "s": "TVC:US10Y", "d": "US 10-Year Treasury" },
            { "s": "TVC:US02Y", "d": "US 2-Year Treasury" },
            { "s": "TVC:US30Y", "d": "US 30-Year Treasury" },
            { "s": "TVC:UK10Y", "d": "UK 10-Year Gilt" },
            { "s": "TVC:DE10Y", "d": "Germany 10-Year Bund" },
            { "s": "TVC:JP10Y", "d": "Japan 10-Year JGB" },
            { "s": "TVC:AU10Y", "d": "Australia 10-Year" },
            { "s": "TVC:CA10Y", "d": "Canada 10-Year" },
            { "s": "TVC:IT10Y", "d": "Italy 10-Year BTP" }
          ]
        }]
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 2B: Fiat & Dollar Pulse (DXY)
const ForexWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "dateRange": "12M",
        "showChart": false,
        "locale": "en",
        "width": "100%",
        "height": "100%",
        "tabs": [{
          "title": "Currencies & DXY",
          "symbols": [
            { "s": "TVC:DXY", "d": "US Dollar Index" },
            { "s": "FX:EURUSD", "d": "Euro / US Dollar" },
            { "s": "FX:USDJPY", "d": "US Dollar / Japanese Yen" },
            { "s": "FX:GBPUSD", "d": "British Pound / USD" },
            { "s": "FX:AUDUSD", "d": "Australian Dollar / USD" },
            { "s": "FX:USDCAD", "d": "US Dollar / Canadian Dollar" },
            { "s": "FX:USDCHF", "d": "US Dollar / Swiss Franc" },
            { "s": "FX:USDCNH", "d": "US Dollar / Offshore Yuan" }
          ]
        }]
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 3A: Systemic Volatility (VIX)
const VolatilityWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "dateRange": "12M",
        "showChart": false,
        "locale": "en",
        "width": "100%",
        "height": "100%",
        "tabs": [{
          "title": "Volatility Indices",
          "symbols": [
            { "s": "CBOE:VIX", "d": "S&P 500 VIX" },
            { "s": "CBOE:VVIX", "d": "VIX Volatility Index" },
            { "s": "CBOE:SKEW", "d": "S&P 500 Skew Index" },
            { "s": "CBOE:VXN", "d": "Nasdaq 100 VIX" },
            { "s": "CBOE:RVX", "d": "Russell 2000 VIX" },
            { "s": "CBOE:VIX3M", "d": "3-Month VIX" },
            { "s": "CME_MINI:ES1!", "d": "S&P 500 Futures (Ref)" }
          ]
        }]
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 3B: Hard Commodities
const CommoditiesWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "dateRange": "12M",
        "showChart": false,
        "locale": "en",
        "width": "100%",
        "height": "100%",
        "tabs": [{
          "title": "Hard Assets",
          "symbols": [
            { "s": "OANDA:XAUUSD", "d": "Gold (USD)" },
            { "s": "OANDA:XAGUSD", "d": "Silver (USD)" },
            { "s": "OANDA:XPTUSD", "d": "Platinum (USD)" },
            { "s": "TVC:USOIL", "d": "Crude Oil (WTI)" },
            { "s": "TVC:UKOIL", "d": "Brent Crude Oil" },
            { "s": "NYMEX:NG1!", "d": "Natural Gas" },
            { "s": "COMEX:HG1!", "d": "Copper Futures" },
            { "s": "CBOT:ZW1!", "d": "Wheat Futures" }
          ]
        }]
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 1A: TradingView Technical Analysis Gauge (Sentiment Proxy)
const CryptoSentimentWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "interval": "1D",
        "width": "100%",
        "isTransparent": true,
        "height": "100%",
        "symbol": "BINANCE:BTCUSDT",
        "showIntervalTabs": true,
        "displayMode": "single",
        "locale": "en",
        "colorTheme": "dark"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 2A: News Flow Widget
const NewsWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "displayMode": "regular",
        "width": "100%",
        "height": "100%",
        "locale": "en"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 2B: Calendar Widget
const CalendarWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "importanceFilter": "-1,0,1",
        "currencyFilter": "USD,EUR,GBP,JPY"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 2C: Stock Market Watch (Hotlists) Widget
const StockMarketWidget = () => {
  const container = useRef();
  
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "dateRange": "12M",
        "exchange": "US",
        "showChart": false, // <-- CHANGED THIS TO FALSE
        "locale": "en",
        "largeChartUrl": "",
        "isTransparent": true,
        "showSymbolLogo": true,
        "showFloatingTooltip": false,
        "width": "100%",
        "height": "100%"
      });
      container.current.appendChild(script);
    }
  }, []);

  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// --- INTELLIGENCE WIDGETS ---

// 1B: Crypto Market News (Ensures continuous data flow)
const TargetedNewsWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "isTransparent": true,
        "displayMode": "regular",
        "width": "100%",
        "height": "100%",
        "locale": "en"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 2B: Global Web3 Conference Tracker (Native UI)
const CryptoCalendarWidget = () => {
  // Real 2026 Blockchain Conference Data
  const events = [
    { date: "Apr 14-16", name: "Paris Blockchain Week", location: "Paris, FR", type: "Global" },
    { date: "Apr 27-29", name: "Bitcoin 2026", location: "Las Vegas, NV", type: "Bitcoin" },
    { date: "May 05-07", name: "Consensus 2026", location: "Miami, FL", type: "Web3 / TradFi" },
    { date: "Jun 11-13", name: "ETHGlobal New York", location: "New York, NY", type: "Hackathon" },
    { date: "Sep 16-17", name: "Euro Blockchain Conv.", location: "Barcelona, ES", type: "Institutional" },
    { date: "Oct 07-08", name: "TOKEN2049 Singapore", location: "Singapore", type: "Global" },
  ];

  return (
    <div className="w-full h-full bg-[#131722] text-white p-6 overflow-y-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-500 uppercase tracking-wider">
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium">Conference</th>
            <th className="pb-3 font-medium">Location</th>
            <th className="pb-3 font-medium text-right">Focus</th>
          </tr>
        </thead>
        <tbody>
          {events.map((item, idx) => (
            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-4 text-sm font-mono text-slate-300">{item.date}</td>
              <td className="py-4 text-sm font-bold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                {item.name}
              </td>
              <td className="py-4 text-sm text-slate-300">{item.location}</td>
              <td className="py-4 text-sm text-right">
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {item.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 3A: Social Narrative (X/Twitter Feed) - NATIVE JSX FIX
const TwitterFeedWidget = () => {
  useEffect(() => {
    const scriptId = 'twitter-wjs';
    
    // Function to trigger Twitter's parsing engine
    const loadTwitterWidget = () => {
      if (window.twttr && window.twttr.widgets) {
        window.twttr.widgets.load();
      }
    };

    if (!document.getElementById(scriptId)) {
      // Inject the script if it doesn't exist
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      
      // Wait for it to load, then fire the widget renderer
      script.onload = loadTwitterWidget;
      document.body.appendChild(script);
    } else {
      // If the script is already there (switched tabs), just tell it to render
      loadTwitterWidget();
    }
  }, []); // Empty dependency array ensures this runs when the tab mounts

  return (
    <div className="w-full h-full overflow-y-auto px-4 flex flex-col items-center">
      {/* React renders the anchor tag natively, Twitter converts it to an iframe */}
      <a 
        className="twitter-timeline" 
        data-theme="dark" 
        data-height="400"
        data-chrome="noheader nofooter noborders transparent" 
        href="https://twitter.com/AlgoFoundation?ref_src=twsrc%5Etfw"
      >
        <div className="animate-pulse text-slate-500 text-xs uppercase tracking-widest mt-10">
          Syncing Social Feed...
        </div>
      </a>
    </div>
  );
};

// 3B: Traditional Finance News Feed (Stocks)
const TradFiNewsWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "feedMode": "market",
        "market": "stock", // Strictly TradFi
        "colorTheme": "dark",
        "isTransparent": true,
        "displayMode": "regular",
        "width": "100%",
        "height": "100%",
        "locale": "en"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

// 3C: Web3 & Crypto News Feed
const CryptoNewsWidget = () => {
  const container = useRef();
  useEffect(() => {
    if (container.current && !container.current.querySelector('script')) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        "feedMode": "market",
        "market": "crypto", // Strictly Web3
        "colorTheme": "dark",
        "isTransparent": true,
        "displayMode": "regular",
        "width": "100%",
        "height": "100%",
        "locale": "en"
      });
      container.current.appendChild(script);
    }
  }, []);
  return <div className="tradingview-widget-container h-full w-full" ref={container} />;
};

export default function DashboardHome() {
  const { accountAddress, isConnected } = useWallet();
  const [inventory, setInventory] = useState({ ipAssets: 0, liveProducts: 0 });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      
      {/* 1. RUNNING TICKER - Always Visible */}
      <TickerTape />

      <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">Command Center</h1>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3 text-green-500" /> System Active</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3 w-3 text-blue-500" /> Global Node: {isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
          {[
            { label: 'Views', value: 0, icon: Eye, color: 'text-blue-400' },
            { label: 'Shares', value: 0, icon: Share2, color: 'text-purple-400' },
            { label: 'Balance', value: '0.00', icon: Wallet, color: 'text-green-400' },
            { label: 'Sales', value: 0, icon: ShoppingCart, color: 'text-red-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/5 border border-white/5 px-4 py-2 rounded-xl min-w-[120px]">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1">{stat.label}</p>
              <p className="text-xl font-black italic tabular-nums leading-none">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="operations" className="w-full">
        <div className="relative w-full">
          <TabsList className="bg-slate-900/50 border border-white/5 p-1 h-12 rounded-2xl mb-8 overflow-x-auto flex-nowrap max-w-full custom-scrollbar">
            <TabsTrigger value="operations" className="rounded-xl px-8 data-[state=active]:bg-green-600 italic font-bold uppercase text-xs">Operations</TabsTrigger>
            <TabsTrigger value="macro" className="rounded-xl px-8 data-[state=active]:bg-blue-600 italic font-bold uppercase text-xs">Market Fundamentals</TabsTrigger>
            <TabsTrigger value="intelligence" className="rounded-xl px-8 data-[state=active]:bg-purple-600 italic font-bold uppercase text-xs opacity-80">Market Intelligence</TabsTrigger>
            <TabsTrigger value="custom" className="rounded-xl px-8 data-[state=active]:bg-purple-600 italic font-bold uppercase text-xs opacity-80">Personal</TabsTrigger>
          </TabsList>
        <div className="absolute top-0 right-0 h-12 w-32 bg-gradient-to-l from-black/100 via-black/70 to-transparent pointer-events-none md:hidden" /></div>

        {/* --- INTERNAL OPERATIONS TAB --- */}
        <TabsContent value="operations" className="mt-0 space-y-6 focus-visible:ring-0">
          
          {/* ROW 1: INFRASTRUCTURE & TREASURY */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 1A: WALLET NODE (Left 4 columns) */}
            <Card className="lg:col-span-4 bg-black border-white/10 overflow-hidden h-[200px] flex flex-col">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
                <CardTitle className="text-xs uppercase font-black italic text-cyan-400 tracking-widest">Protocol Connection</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">useWallet Status</span>
              </CardHeader>
              <CardContent className="p-0 flex-1 bg-[#131722]">
                <WalletStatusWidget />
              </CardContent>
            </Card>

            {/* 1B: SYSTEM ALERTS / LOGS (Right 8 columns) */}
            <Card className="lg:col-span-8 bg-black border-white/10 overflow-hidden h-[200px]">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
                <CardTitle className="text-xs uppercase font-black italic tracking-widest">Event Telemetry</CardTitle>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-400 uppercase">System Logs</span>
              </CardHeader>
              <CardContent className="p-6 h-full bg-[#131722] font-mono text-xs text-slate-400 flex flex-col justify-center space-y-2">
                <div className="flex gap-4"><span className="text-cyan-400">[SYS]</span> <span>Smart Contract 'ASA-8824' successfully verified.</span></div>
                <div className="flex gap-4"><span className="text-green-400">[TXN]</span> <span>Incoming royalty distribution: 450 USDC.</span></div>
                <div className="flex gap-4"><span className="text-orange-400">[WRN]</span> <span>Oracle data feed for 'Brand Trademark' awaiting sync.</span></div>
              </CardContent>
            </Card>

          </div>

          <ExecutionDirectives />

          {/* ROW 2: INVENTORY & MARKETS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 2A: IP ASSET LEDGER (Left 8 columns) */}
            <Card className="lg:col-span-8 bg-black border-white/10 overflow-hidden h-[500px]">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
                <CardTitle className="text-xs uppercase font-black italic text-purple-400">Tokenized IP Inventory</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">inventory.ipAssets</span>
              </CardHeader>
              <CardContent className="p-0 h-full bg-[#131722]">
                <IPAssetLedger />
              </CardContent>
            </Card>

            {/* 2B: LIVE PRODUCTS (Right 4 columns) */}
            <Card className="lg:col-span-4 bg-black border-white/10 overflow-hidden h-[500px]">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
                <CardTitle className="text-xs uppercase font-black italic text-green-400">Live Product Telemetry</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">liveProducts</span>
              </CardHeader>
              <CardContent className="p-0 h-[450px] bg-[#131722]">
                <LiveProductsTelemetry />
              </CardContent>
            </Card>

          </div>

        </TabsContent>

        {/* --- GLOBAL MARKETS TAB --- */}
        <TabsContent value="macro" className="mt-0 space-y-6 focus-visible:ring-0">
          
          {/* ROW 1: DUAL HEATMAPS (The Pulse) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1A: CRYPTO HEATMAP */}
            <Card className="bg-black border-white/10 overflow-hidden h-[500px]">
              <CardContent className="p-0 h-full">
                <iframe 
                  src="https://www.tradingview-widget.com/embed-widget/crypto-coins-heatmap/?locale=en&dataSource=crypto&colorTheme=dark&hasTopBar=false&isTransparent=true&hasDetails=true&width=100%25&height=100%25"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </CardContent>
            </Card>

            {/* 1B: STOCK MARKET HEATMAP */}
            <Card className="bg-black border-white/10 overflow-hidden h-[500px]">
              <CardContent className="p-0 h-full">
                <iframe 
                  src="https://www.tradingview-widget.com/embed-widget/stock-heatmap/?locale=en&hasTopBar=false&isTransparent=true&hasDetails=true&colorTheme=dark&symbolQuery=S%26P%20500&width=100%25&height=100%25"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </CardContent>
            </Card>
          </div>

          {/* ROW 2: COST OF CAPITAL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            
            {/* 2A: GLOBAL INTEREST RATES */}
            <Card className="bg-black border-white/10 overflow-hidden h-[420px] flex flex-col">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row shrink-0">
                <CardTitle className="text-xs uppercase font-black italic text-blue-400">Global Interest Rates</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">The Smart Money</span>
              </CardHeader>
              <CardContent className="p-0 flex-1 bg-[#131722]">
                <BondsWidget />
              </CardContent>
            </Card>

            {/* 2B: FIAT & DOLLAR PULSE */}
            <Card className="bg-black border-white/10 overflow-hidden h-[420px] flex flex-col">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row shrink-0">
                <CardTitle className="text-xs uppercase font-black italic text-emerald-400">Fiat & Dollar Pulse</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Global Liquidity</span>
              </CardHeader>
              <CardContent className="p-0 flex-1 bg-[#131722]">
                <ForexWidget />
              </CardContent>
            </Card>

          </div>

          {/* ROW 3: FLIGHT TO SAFETY & RISK */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            
            {/* 3A: SYSTEMIC VOLATILITY */}
            <Card className="bg-black border-white/10 overflow-hidden h-[420px] flex flex-col">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row shrink-0">
                <CardTitle className="text-xs uppercase font-black italic text-red-400">Systemic Volatility</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Risk Barometer</span>
              </CardHeader>
              <CardContent className="p-0 flex-1 bg-[#131722]">
                <VolatilityWidget />
              </CardContent>
            </Card>

            {/* 3B: HARD COMMODITIES */}
            <Card className="bg-black border-white/10 overflow-hidden h-[420px] flex flex-col">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row shrink-0">
                <CardTitle className="text-xs uppercase font-black italic text-yellow-500">Hard Commodities</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Inflation Hedges</span>
              </CardHeader>
              <CardContent className="p-0 flex-1 bg-[#131722]">
                <CommoditiesWidget />
              </CardContent>
            </Card>

          </div>

          {/* ROW 4: DEEP DIVE (ADVANCED CHART) */}
          <Card className="bg-black border-white/10 overflow-hidden h-[800px]">
            <CardContent className="p-0 h-full bg-[#131722]">
              {/* Note the style=2 parameter for the Line Graph */}
              <iframe 
                src="https://s.tradingview.com/widgetembed/?symbol=BINANCE%3AALGOUSDT&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&theme=dark&style=2&timezone=Etc%2FUTC&locale=en"
                style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#131722' }}
                loading="lazy"
              />
            </CardContent>
          </Card>

        </TabsContent>

        {/* --- GLOBAL INTELLIGENCE TAB --- */}
        <TabsContent value="intelligence" className="mt-0 space-y-6 focus-visible:ring-0">
          
          {/* ROW 1: SENTIMENT & NARRATIVE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 1A: FEAR & GREED (Fixed: Using Image API instead of iframe) */}
            <Card className="lg:col-span-4 bg-black border-white/10 overflow-hidden h-[400px] flex flex-col">
              <CardContent className="p-0 flex-1 bg-[#131722]">
                <CryptoSentimentWidget />
              </CardContent>
            </Card>

            {/* 1B: ASSET NEWS */}
            <Card className="lg:col-span-8 bg-black border-white/10 overflow-hidden h-[400px]">
              <CardContent className="p-0 h-[400px] bg-[#131722]">
                <TargetedNewsWidget />
              </CardContent>
            </Card>

          </div>

          {/* ROW 2: THE CATALYST TRACKERS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 2A: ECONOMIC EVENTS (Governments/Fed) */}
            <Card className="bg-black border-white/10 overflow-hidden h-[500px]">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
                <CardTitle className="text-xs uppercase font-black italic text-orange-400">Macro Economic Catalyst</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Gov & Central Banks</span>
              </CardHeader>
              <CardContent className="p-0 h-full bg-[#131722]">
                <CalendarWidget />
              </CardContent>
            </Card>

            {/* 2B: WEB3 PROTOCOL EVENTS (Token Unlocks & Upgrades) */}
            <Card className="bg-black border-white/10 overflow-hidden h-[500px]">
              <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
                <CardTitle className="text-xs uppercase font-black italic text-green-400">Global Industry Summits</CardTitle>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Capital & Builder Hubs</span>
              </CardHeader>
              <CardContent className="p-0 h-[450px] bg-[#131722] overflow-hidden">
                <CryptoCalendarWidget />
              </CardContent>
            </Card>

          </div>

          {/* ROW 3: THE GLOBAL FIREHOSE (3-Column Split) */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    {/* 3A: SOCIAL NARRATIVE */}
    <Card className="bg-black border-white/10 overflow-hidden h-[450px]">
      <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
        <CardTitle className="text-xs uppercase font-black italic text-blue-400 tracking-widest">Social Narrative</CardTitle>
        <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase">LIVE FEED</span>
      </CardHeader>
      <CardContent className="p-0 h-[400px] bg-[#131722] overflow-hidden">
        <TwitterFeedWidget />
      </CardContent>
    </Card>

    {/* 3B: TRADITIONAL FINANCE INTEL */}
    <Card className="bg-black border-white/10 overflow-hidden h-[450px]">
      <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
        <CardTitle className="text-xs uppercase font-black italic tracking-widest text-slate-300">TradFi & Equities</CardTitle>
        <span className="text-[9px] font-bold text-slate-500 uppercase">Global Markets</span>
      </CardHeader>
      <CardContent className="p-0 h-[400px] bg-[#131722]">
        <TradFiNewsWidget />
      </CardContent>
    </Card>

    {/* 3C: WEB3 & CRYPTO INTEL */}
    <Card className="bg-black border-white/10 overflow-hidden h-[450px]">
      <CardHeader className="py-3 border-b border-white/5 bg-slate-950 flex justify-between items-center flex-row">
        <CardTitle className="text-xs uppercase font-black italic tracking-widest text-green-400">Web3 & Digital Assets</CardTitle>
        <span className="text-[9px] font-bold text-slate-500 uppercase">Crypto Markets</span>
      </CardHeader>
      <CardContent className="p-0 h-[400px] bg-[#131722]">
        <CryptoNewsWidget />
      </CardContent>
    </Card>

  </div>

        </TabsContent>

        {/* --- PERSONAL TAB --- */}
        <TabsContent value="custom" className="mt-0">
          <div className="h-[500px] rounded-[40px] border-2 border-dashed border-white/5 bg-slate-950/50 flex flex-col items-center justify-center text-center p-12">
             <Layout className="h-16 w-16 text-purple-500 mb-8 animate-pulse" />
             <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4 text-purple-400">Personal Modular Cockpit</h2>
             <p className="text-slate-400 max-w-lg italic font-medium">Coming Soon: Configure your own layout with private Aisle stats and custom data feeds.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}