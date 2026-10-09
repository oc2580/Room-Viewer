// Email notifications via Wix Triggered Emails. Every function here is
// best-effort: a missing template or contact must never block a request.
import { contacts, triggeredEmails } from 'wix-crm-backend';
import {
  EMAIL_DIRECTOR_ALERT, EMAIL_COLLECTOR_UPDATE, DIRECTOR_EMAIL, ROOM_URL_PREFIX,
} from 'backend/pvr.config';

async function contactIdFor(email, name) {
  const [first, ...rest] = String(name || '').split(' ');
  const res = await contacts.appendOrCreateContact({
    name: { first: first || '', last: rest.join(' ') },
    emails: [{ email }],
  });
  return res.contactId;
}

export async function alertDirector({ room, print, type, message }) {
  if (!EMAIL_DIRECTOR_ALERT) return;
  try {
    const contactId = await contactIdFor(DIRECTOR_EMAIL, 'Studio Director');
    await triggeredEmails.emailContact(EMAIL_DIRECTOR_ALERT, contactId, {
      variables: {
        collectorName: room.collectorName,
        printTitle: print,
        requestType: type,
        message: message || '(no message)',
      },
    });
  } catch (err) {
    console.error('PVR director alert failed', err);
  }
}

export async function updateCollector({ room, print, headline, reply }) {
  if (!EMAIL_COLLECTOR_UPDATE || !room.collectorEmail) return;
  try {
    const contactId = room.contactId || await contactIdFor(room.collectorEmail, room.collectorName);
    await triggeredEmails.emailContact(EMAIL_COLLECTOR_UPDATE, contactId, {
      variables: {
        collectorName: room.collectorName,
        printTitle: print,
        headline,
        reply: reply || '',
        roomUrl: `https://www.jackvettriano.studio${ROOM_URL_PREFIX}${room.slug}`,
      },
    });
  } catch (err) {
    console.error('PVR collector update failed', err);
  }
}
