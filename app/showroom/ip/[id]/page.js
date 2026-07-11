"use client";

import { useRouter } from 'next/navigation';
import IPConsumerDialog from '@/components/ip/IPConsumerDialog';
// ...other imports

export default function IPShowroomPage({ params }) {
  const router = useRouter();
  const { id } = params;

  const [ip, setIp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIp = async () => {
      const res = await fetch(`/api/ip/${id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setIp(data.ipAsset);
      }
      setLoading(false);
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
