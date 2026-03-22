'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import Image from 'next/image';

export default function TopProducts({ products }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Top Performing Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.map((product, idx) => (
            <div 
              key={product.id} 
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {idx + 1}
              </div>
              
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.sales} sales</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-green-500">${product.revenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  ${(product.revenue / product.sales).toFixed(2)} avg
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}