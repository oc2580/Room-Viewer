// Router for /pvr/<room-slug>. Add the router in the Editor first (prefix
// "pvr"); Wix then creates this file and the "pvr-page" router page.
import { ok, notFound } from 'wix-router';
import wixData from 'wix-data';
import { COLLECTIONS, ROUTER_PAGE } from 'backend/pvr.config';
import { buildRoomPayload, findRoomBySlug, roomIsOpen, now } from 'backend/pvr-lib';

const HEAD = {
  title: 'Private Viewing Room | Jack Vettriano Studio',
  description: 'A private selection prepared for you by Jack Vettriano Studio.',
  noIndex: true,
};

export async function pvr_Router(request) {
  const room = await findRoomBySlug(request.path[0]);
  const isAdmin = request.user && request.user.role === 'Admin';
  if (!room || (room.status === 'draft' && !isAdmin)) return notFound();

  if (!roomIsOpen(room) && !isAdmin) {
    return ok(ROUTER_PAGE, { closed: true, collectorName: room.collectorName }, HEAD);
  }

  if (!isAdmin) {
    const t = now();
    await wixData.update(COLLECTIONS.rooms, {
      ...room,
      firstOpenedAt: room.firstOpenedAt || t,
      lastOpenedAt: t,
      openCount: (room.openCount || 0) + 1,
    }, { suppressAuth: true });
  }
  const payload = await buildRoomPayload(room);
  return ok(ROUTER_PAGE, { ...payload, preview: isAdmin }, HEAD);
}

// Viewing rooms are private: nothing goes in the sitemap.
export function pvr_SiteMap() {
  return [];
}
