'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function EarningsChart({ data, timeframe }) {
  const maxValue = Math.max(...data.map(d => 
    d.productSales + d.ipRoyalties + d.adRevenue + d.tips
  ));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Revenue Trends
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Last {timeframe === '6months' ? '6 Months' : '12 Months'}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart bars */}
          <div className="flex items-end justify-between h-64 gap-2">
            {data.map((item, idx) => {
              const total = item.productSales + item.ipRoyalties + item.adRevenue + item.tips;
              const heightPercent = (total / maxValue) * 100;
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative" style={{ height: '200px' }}>
                    <div 
                      className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:opacity-80 transition-opacity cursor-pointer"
                      style={{ height: `${heightPercent}%` }}
                      title={`$${total.toFixed(2)}`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-muted-foreground">Product Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-muted-foreground">IP Royalties</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-muted-foreground">Ad Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm text-muted-foreground">Tips</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}