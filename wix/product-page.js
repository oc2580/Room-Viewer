// Wix Velo code for a Wix Stores *Product Page*.
// Adds a "View on your wall" button that opens the Room Viewer with this
// product's image and real dimensions. See docs/WIX_SETUP.md for setup.
//
// Page elements this code expects (add them in the Wix Editor):
//   #productPage1   – the built-in Product Page element (already on the page)
//   #roomViewButton – a Button you add, labelled e.g. "View on your wall"
//
// Optional: instead of a button, add an HTML iframe element (#roomViewer)
// pointing at VIEWER_URL – the code below will send it the artwork.

const VIEWER_URL = 'https://oc2580.github.io/Room-Viewer/';

// Products that show the button (the part of the product's address after
// /product-page/). Add more as you roll it out; empty the list to show the
// button on every product.
const ENABLED_PRODUCT_SLUGS = ['young-hearts', 'narcissistic-bathers', 'exit-eden'];

$w.onReady(async function () {
  const product = await $w('#productPage1').getProduct();
  const enabled = ENABLED_PRODUCT_SLUGS.length === 0 || ENABLED_PRODUCT_SLUGS.includes(product.slug);
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

  // If you embedded the viewer in the page, hand it the artwork once it's ready.
  try {
    if (!artwork) {
      $w('#roomViewer').hide();
    } else {
      $w('#roomViewer').onMessage((event) => {
        if (event.data && event.data.type === 'roomviewer:ready') {
          $w('#roomViewer').postMessage({ type: 'roomviewer:setArtwork', ...artwork });
        }
      });
    }
  } catch (e) {
    // No embedded viewer on this page.
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

  // Sizes as written in the description, e.g. "Image size: 39 x 30.7 cm".
  const aspect = image.width && image.height ? image.width / image.height : null;
  const art = readSize(text, /image size/i, aspect);
  const mount = readSize(text, /mount size/i, aspect);
  const framed = readSize(text, /framed size/i, aspect);

  const params = {
    img: image.url,
    title: product.name,
    artist: product.brand || '',
    unit: 'cm',
    // The two choices of the product's "Frame" option: Unframed, or the
    // publisher's black frame with a gold slip. Opens showing it framed.
    frames: 'none,publisher',
    frame: 'publisher',
    buy: `${siteBase()}/product-page/${product.slug}`,
  };
  if (art) {
    params.w = art.w;
    params.h = art.h;
    if (mount) params.mat = round((mount.w - art.w + (mount.h - art.h)) / 4);
    if (mount && framed) params.framew = round((framed.w - mount.w + (framed.h - mount.h)) / 4);
  }
  return params;
}

// Finds "<label> ... 39 x 30.7 cm" and returns {w, h} in cm. The two numbers
// are matched to the image's proportions, so "height x width" and
// "width x height" are both handled.
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

// "wix:image://v1/abc~mv2.png/name.png#originWidth=800&originHeight=1014"
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

function siteBase() {
  return 'https://www.jackvettriano.studio';
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
