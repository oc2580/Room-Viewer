// Scheduled from jobs.config: releases confirmed holds once their 48 hours end.
import wixData from 'wix-data';
import { COLLECTIONS } from 'backend/pvr.config';
import { queryAll, now } from 'backend/pvr-lib';

export async function expireHolds() {
  const expired = await queryAll(
    wixData.query(COLLECTIONS.requests)
      .eq('type', 'hold').eq('status', 'confirmed').lt('holdExpiresAt', now())
  );
  for (const r of expired) {
    await wixData.update(COLLECTIONS.requests, { ...r, status: 'expired' }, { suppressAuth: true });
  }
  return { expired: expired.length };
}
