// Wix Velo code for a Wix Stores *Product Page*.
// Adds a "View on your wall" button that opens the Room Viewer with this
// product's image and sizes. See docs/WIX_SETUP.md for step-by-step setup.
//
// Page elements this code expects (add them in the Wix Editor):
//   #productPage1   – the built-in Product Page element (already on the page)
//   #roomViewButton – a Button you add, labelled e.g. "View on your wall"
//
// Optional: instead of a button, add an HTML iframe element (#roomViewer)
// pointing at VIEWER_URL – the code below will send it the artwork.

const VIEWER_URL = 'https://YOUR-GITHUB-USERNAME.github.io/Room-Viewer/';

// Unit your size choices are written in ("60 x 80 cm", "24x36 in", ...).
const DEFAULT_UNIT = 'cm';

$w.onReady(async function () {
  const product = await $w('#productPage1').getProduct();
  const artwork = artworkFromProduct(product);

  try {
    $w('#roomViewButton').link = viewerUrl(artwork);
    $w('#roomViewButton').target = '_blank';
  } catch (e) {
    // No button on this page.
  }

  // If you embedded the viewer in the page, hand it the artwork once it's ready.
  try {
    $w('#roomViewer').onMessage((event) => {
      if (event.data && event.data.type === 'roomviewer:ready') {
        $w('#roomViewer').postMessage({ type: 'roomviewer:setArtwork', ...artwork });
      }
    });
  } catch (e) {
    // No embedded viewer on this page.
  }
});

function artworkFromProduct(product) {
  return {
    img: wixImageToUrl(product.mainMedia),
    title: product.name,
    sizes: sizesFromProduct(product),
    unit: DEFAULT_UNIT,
    buy: product.productPageUrl ? `${siteBase()}${product.productPageUrl}` : '',
  };
}

// Reads sizes from a product option such as "Size" with choices "60 x 80 cm".
function sizesFromProduct(product) {
  const options = product.productOptions || {};
  const sizes = [];
  for (const key of Object.keys(options)) {
    for (const choice of options[key].choices || []) {
      const m = /(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/.exec(choice.description || choice.value || '');
      if (m) sizes.push(`${m[1]}x${m[2]}`);
    }
  }
  return sizes.join(',');
}

// "wix:image://v1/abc~mv2.jpg/name.jpg#originWidth=..." -> https://static.wixstatic.com/media/abc~mv2.jpg
function wixImageToUrl(src) {
  const m = /^wix:image:\/\/v1\/([^/]+)\//.exec(src || '');
  return m ? `https://static.wixstatic.com/media/${m[1]}` : src;
}

function siteBase() {
  // productPageUrl is relative ("/product-page/slug"); update if your site uses a custom domain path.
  return 'https://www.YOUR-SITE.com';
}

function viewerUrl(a) {
  const params = Object.entries(a)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${VIEWER_URL}?${params}`;
}
