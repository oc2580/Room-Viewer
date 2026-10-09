// Email notifications via Wix Triggered Emails. Best-effort: a missing
// template or contact never blocks a visitor's request.
import { contacts, triggeredEmails } from 'wix-crm-backend';
import {
  EMAIL_STUDIO_ALERT, EMAIL_VISITOR_UPDATE, STUDIO_EMAIL, GALLERY_URL,
} from 'backend/gallery.config';

export async function contactIdFor(email, name) {
  const [first, ...rest] = String(name || '').split(' ');
  const res = await contacts.appendOrCreateContact({
    name: { first: first || '', last: rest.join(' ') },
    emails: [{ email }],
  });
  return res.contactId;
}

export async function alertStudio({ lead, print, type, message }) {
  if (!EMAIL_STUDIO_ALERT) return;
  try {
    const contactId = await contactIdFor(STUDIO_EMAIL, 'Studio');
    await triggeredEmails.emailContact(EMAIL_STUDIO_ALERT, contactId, {
      variables: { visitorName: lead.name, visitorEmail: lead.email, printTitle: print, requestType: type, message: message || '(no message)' },
    });
  } catch (err) {
    console.error('Gallery studio alert failed', err);
  }
}

export async function updateVisitor({ lead, print, headline, reply }) {
  if (!EMAIL_VISITOR_UPDATE || !lead || !lead.contactId) return;
  try {
    await triggeredEmails.emailContact(EMAIL_VISITOR_UPDATE, lead.contactId, {
      variables: { visitorName: lead.name, printTitle: print, headline, reply: reply || '', galleryUrl: GALLERY_URL },
    });
  } catch (err) {
    console.error('Gallery visitor update failed', err);
  }
}
