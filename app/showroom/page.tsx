import { Suspense } from 'react';
import ShowroomClient from './ShowroomClient';
console.log('SHOWROOM_PAGE_RENDER');
export default function ShowroomPage() {
  return (
    <Suspense fallback={null}>
      <ShowroomClient />
    </Suspense>
  );
}
