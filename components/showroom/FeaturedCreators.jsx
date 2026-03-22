'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Star, Package, TrendingUp } from 'lucide-react';

export default function FeaturedCreators({ creators }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % creators.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev - 1 + creators.length) % creators.length);
  };

  const currentCreator = creators[currentIndex];

  return (
    <div className="relative">
      <Card className="overflow-hidden bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* Left - Image */}
          <div className="relative h-80 rounded-lg overflow-hidden">
            <Image
              src={currentCreator.bannerUrl}
              alt={currentCreator.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <Badge className="absolute top-4 left-4 bg-yellow-500 text-black border-0">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Featured
            </Badge>
          </div>

          {/* Right - Info */}
          <div className="flex flex-col justify-center">
            <Badge className="w-fit mb-3" variant="secondary">
              {currentCreator.category}
            </Badge>
            <h3 className="text-3xl font-bold mb-3">{currentCreator.name}</h3>
            <p className="text-lg text-muted-foreground mb-6">{currentCreator.bio}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{currentCreator.stats.totalProducts}</div>
                  <div className="text-xs text-muted-foreground">Products</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{currentCreator.stats.totalSales}</div>
                  <div className="text-xs text-muted-foreground">Sales</div>
                </div>
              </div>
            </div>

            <Link href={`/aisle/${currentCreator.slug}`}>
              <Button size="lg" className="w-full md:w-auto">
                Visit {currentCreator.name}'s Aisle
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Navigation Arrows */}
      {creators.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute top-1/2 -left-4 -translate-y-1/2 rounded-full bg-background shadow-lg"
            onClick={prev}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute top-1/2 -right-4 -translate-y-1/2 rounded-full bg-background shadow-lg"
            onClick={next}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          {/* Indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {creators.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-primary w-8' : 'bg-muted-foreground/30'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}