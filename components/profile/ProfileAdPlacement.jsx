'use client';

import { Card, CardContent } from '@/components/ui/card';

export default function ProfileAdPlacement({ type }) {
  const adConfig = {
    header: {
      height: '90px',
      width: '100%',
      text: 'Header Ad 728x90',
    },
    sidebar: {
      height: '250px',
      width: '100%',
      text: 'Sidebar Ad 300x250',
    },
    content: {
      height: '100px',
      width: '100%',
      text: 'Content Ad 728x90',
    },
  };

  const config = adConfig[type];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div
          className="bg-muted flex items-center justify-center text-muted-foreground text-sm"
          style={{ height: config.height, width: config.width }}
        >
          <div className="text-center">
            <p className="font-semibold">Advertisement</p>
            <p className="text-xs mt-1">{config.text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
