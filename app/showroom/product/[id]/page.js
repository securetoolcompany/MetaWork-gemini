import { redirect } from 'next/navigation';

export default async function LegacyShowroomProductPage({ params }) {
  const { id } = await params;
  redirect(`/products/${id}`);
}