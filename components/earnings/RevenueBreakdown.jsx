'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Image, BarChart3, Heart } from 'lucide-react';

export default function RevenueBreakdown({ data }) {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);

  const items = [
    { 
      label: 'Product Sales', 
      value: data.productSales, 
      icon: ShoppingCart,
      color: 'bg-blue-500',
      textColor: 'text-blue-500'
    },
    { 
      label: 'IP Royalties', 
      value: data.ipRoyalties, 
      icon: Image,
      color: 'bg-purple-500',
      textColor: 'text-purple-500'
    },
    { 
      label: 'Ad Revenue', 
      value: data.adRevenue, 
      icon: BarChart3,
      color: 'bg-green-500',
      textColor: 'text-green-500'
    },
    { 
      label: 'Tips', 
      value: data.tips, 
      icon: Heart,
      color: 'bg-orange-500',
      textColor: 'text-orange-500'
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Revenue Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Pie chart representation */}
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {items.map((item, idx) => {
                  const percentage = total > 0 ? (item.value / total) * 100 : 0;
                  const prevPercentages = total > 0
                    ? items.slice(0, idx).reduce((sum, i) => sum + (i.value / total) * 100, 0)
                    : 0;
                  const radius = 40;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                  const strokeDashoffset = -((prevPercentages / 100) * circumference);

                  return (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={`rgb(${idx === 0 ? '59, 130, 246' : idx === 1 ? '139, 92, 246' : idx === 2 ? '34, 197, 94' : '249, 115, 22'})`}
                      strokeWidth="20"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {items.map((item, idx) => {
              const Icon = item.icon;
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
              
              return (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{percentage}%</span>
                    <span className={`text-sm font-semibold ${item.textColor}`}>
                      ${item.value.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}