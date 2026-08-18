import { Resend } from 'resend';
import { renderPayoutReleasedEmail } from '@/lib/email/templates/payout-released';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPayoutReleasedEmail({
  recipientEmail,
  recipientName,
  payoutAmount,
  poolName,
  assetName,
  releaseDate,
  ipId,
  roundId,
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://metawork.tools';

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'MetaWork <notifications@metawork.tools>',
    to: [recipientEmail],
    subject: `Payout available: ${payoutAmount} ready to claim`,
    html: renderPayoutReleasedEmail({
      recipientName,
      payoutAmount,
      poolName,
      assetName,
      releaseDate: new Date(releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      revenueDashboardUrl:
        `${appUrl}/earnings?ipId=${encodeURIComponent(ipId)}&roundId=${encodeURIComponent(roundId)}`,
      currentYear: new Date().getFullYear(),
    }),
  });
}