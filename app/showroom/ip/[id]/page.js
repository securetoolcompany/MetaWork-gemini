"use client";

import { useRouter } from 'next/navigation';
import IPConsumerDialog from '@/components/ip/IPConsumerDialog';

export default function IPShowroomPage({ params }) {
  const router = useRouter();
  const { id } = params;

  const [ip, setIp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchIp = async () => {
      try {
        const res = await fetch(`/api/ip/${id}`, {
          cache: 'no-store',
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setIp(data.ipAsset);
        }
      } catch (error) {
        console.error('Failed to load IP asset:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIp();
  }, [id]);

  if (loading || !ip) return null;

  return (
    <IPConsumerDialog
      ip={ip}
      onBack={() => router.back()}
      onSelect={(ipToUse) => {
        router.push(`/products/creator?ipId=${ipToUse._id || ipToUse.id}`);
      }}
    />
  );
}
