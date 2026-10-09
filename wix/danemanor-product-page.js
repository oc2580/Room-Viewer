// Wix Velo code for the Dane Manor Fine Art *Product Page*.
// Adds a "View on your wall" button to Leigh Lambert products only, opening
// the Room Viewer with the product's image and real framed size.
// See docs/WIX_SETUP.md for setup (same steps as the Jack Vettriano site).
//
// Page elements this code expects (add them in the Wix Editor):
//   #productPage1   – the built-in Product Page element (already on the page)
//   #roomViewButton – a Button you add, labelled "View on your wall",
//                     set to "Hidden on load"

const VIEWER_URL = 'https://oc2580.github.io/Room-Viewer/';
const SITE_BASE = 'https://www.danemanorfineart.com';

// Only products whose brand is one of these show the button.
const ENABLED_BRANDS = ['Leigh Lambert'];

// How the framed pieces are shown. Frame styles are defined in js/config.js
// of the viewer ('black', 'white', 'oak', 'walnut', 'gold', ...).
const FRAME_STYLE = 'black';
// Framed editions (canvas and paper): a white mount plus a frame this wide
// (cm). The rest of the gap between "Image size" and "Framed size" is mount.
const FRAME_CM = 5;
// Mount used when a product gives no "Framed size" (the viewer then marks
// the framed size as approximate).
const DEFAULT_MOUNT_CM = 8;
// If the photo's shape differs from the listed image size by more than this,
// the photo already shows the frame and mount, so nothing is added to it.
const FRAMED_PHOTO_TOLERANCE = 0.04;

$w.onReady(async function () {
  const product = await $w('#productPage1').getProduct();
  const enabled = ENABLED_BRANDS.includes((product.brand || '').trim());
  const artwork = enabled ? artworkFromProduct(product) : null;

  try {
    if (artwork) {
      $w('#roomViewButton').link = viewerUrl(artwork);
      $w('#roomViewButton').target = '_blank';
      $w('#roomViewButton').show();
    } else {
      $w('#roomViewButton').hide();
    }
  } catch (e) {
    // No button on this page.
  }
});

function artworkFromProduct(product) {
  const image = wixImage(product.mainMedia);
  const text = [
    product.description || '',
    ...(product.additionalInfoSections || []).map((s) => `${s.title}: ${s.description}`),
  ]
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');

  const aspect = image.width && image.height ? image.width / image.height : null;
  const art = readSize(text, /image size/i, aspect);
  if (!art) return null; // can't show true size without the image size

  const framed = readSize(text, /framed size/i, aspect);

  const params = {
    site: 'danemanor',
    img: image.url,
    title: product.name,
    artist: product.brand || '',
    unit: 'cm',
    w: art.w,
    h: art.h,
    frames: FRAME_STYLE,
    frame: FRAME_STYLE,
    buy: `${SITE_BASE}/product-page/${product.slug}`,
  };

  if (aspect && Math.abs(aspect - art.w / art.h) / (art.w / art.h) > FRAMED_PHOTO_TOLERANCE) {
    return framedPhoto(params, aspect, art, framed);
  }

  // Average border between the image and the outside of the frame.
  const border = framed ? (framed.w - art.w + (framed.h - art.h)) / 4 : null;
  params.framew = FRAME_CM;
  if (border > FRAME_CM) {
    params.mat = round(border - FRAME_CM);
  } else if (border > 0) {
    params.framew = round(border); // listed border is narrower than a frame: no mount
  } else {
    params.mat = DEFAULT_MOUNT_CM;
    params.approx = 1;
  }
  return params;
}

// The photo already shows the framed piece: show it as it is, sized to the
// framed size (matching its longer side), with no extra frame or mount.
function framedPhoto(params, aspect, art, framed) {
  params.frames = 'pictured';
  params.frame = 'pictured';
  let size = framed;
  if (!size) {
    // No framed size listed: estimate an even border that gives the photo's shape.
    const b = (art.w - aspect * art.h) / (2 * (aspect - 1));
    size = b > 0 && b < 40 ? { w: art.w + 2 * b, h: art.h + 2 * b } : art;
    params.approx = 1;
  }
  if (aspect >= 1) {
    params.w = round(size.w);
    params.h = round(size.w / aspect);
  } else {
    params.h = round(size.h);
    params.w = round(size.h * aspect);
  }
  // Photo shape noticeably different from the listed framed size (e.g. a
  // photo with some background): the size shown is approximate.
  if (framed && Math.abs(aspect - framed.w / framed.h) / (framed.w / framed.h) > 0.05) params.approx = 1;
  return params;
}

// Finds "<label>: 48 x 69 cm" and returns {w, h} in cm, matching the two
// numbers to the image's proportions so either order works.
function readSize(text, label, aspect) {
  const re = new RegExp(`${label.source}\\s*:?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:cm)?\\s*[x×X]\\s*(\\d+(?:\\.\\d+)?)\\s*(cm|mm|in|")?`, 'i');
  const m = re.exec(text);
  if (!m) return null;
  const k = m[3] === 'mm' ? 0.1 : m[3] === 'in' || m[3] === '"' ? 2.54 : 1;
  const a = parseFloat(m[1]) * k;
  const b = parseFloat(m[2]) * k;
  if (!aspect) return { w: a, h: b };
  return Math.abs(a / b - aspect) <= Math.abs(b / a - aspect) ? { w: a, h: b } : { w: b, h: a };
}

// "wix:image://v1/abc~mv2.jpg/name.jpg#originWidth=1000&originHeight=772"
function wixImage(src) {
  const m = /^wix:image:\/\/v1\/([^/]+)\/[^#]*(?:#(.*))?$/.exec(src || '');
  if (!m) return { url: src };
  const q = new URLSearchParams(m[2] || '');
  return {
    url: `https://static.wixstatic.com/media/${m[1]}`,
    width: parseFloat(q.get('originWidth')),
    height: parseFloat(q.get('originHeight')),
  };
}

function round(n) {
  return Math.round(n * 10) / 10;
}

function viewerUrl(a) {
  const params = Object.entries(a)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${VIEWER_URL}?${params}`;
}
