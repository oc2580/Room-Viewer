# Room Viewer — "View on your wall" for an online art gallery

Visitors upload a photo of their own wall, and the artwork appears on it **at its true size**. On a phone they can also place it on the wall in **augmented reality (AR)**.

No build step, no server code, no dependencies: plain HTML/CSS/JS you can host anywhere (GitHub Pages works) and link to or embed in a Wix site.

## What visitors can do

1. **Choose a wall**: upload a photo, take one with the phone camera, or use the built-in sample room.
2. **Set the scale**: drag a line over something of known size (a door, light switch, sheet of paper) and the app works out the real scale of the photo. Until they do, it assumes the wall in the photo is about 3 m wide.
3. **Position and style**: drag the artwork, choose a size, frame (unframed, black, white, oak, walnut, gold) and mat, adjust brightness to match the room's lighting, and toggle the wall shadow. **Adjust perspective** lets them drag the corners to match a wall photographed at an angle.
4. **Download or share** a JPEG of the mockup, with a caption strip showing the title, size and gallery name.
5. **View in AR**: the app builds a real-size 3D model of the framed piece in the browser and opens it with [model-viewer](https://modelviewer.dev):
   - **iPhone/iPad**: AR Quick Look (wall placement).
   - **Android**: WebXR in Chrome on ARCore devices.
   - **Desktop**: a 3D preview plus a QR code to open the viewer on a phone.

Units switch between cm and inches.

## Linking to an artwork

All artwork details are passed in the URL:

```
https://YOUR-HOST/Room-Viewer/?img=https://static.wixstatic.com/media/abc~mv2.jpg&title=Evening%20Field&artist=A.%20Painter&sizes=40x53,60x80,90x120&unit=cm&frame=oak
```

| Param | Meaning |
|---|---|
| `img` | Artwork image URL (must allow CORS for download/AR — Wix media URLs do) |
| `title`, `artist` | Shown in the header and on downloads |
| `w`, `h` | Width and height (alternative to `sizes`; give one and the other is calculated from the image's proportions) |
| `sizes` | Comma-separated sizes the work is sold in, e.g. `40x53,60x80` |
| `unit` | `cm` (default) or `in`, the unit `w`/`h`/`sizes`/`mat` are written in |
| `size` | Which entry in `sizes` to show first (0-based) |
| `frame` | `none`, `black`, `white`, `oak`, `walnut`, `gold` |
| `mat` | Mat width (`5` or `8` cm) |
| `buy` | Link for the "Back to artwork" button |
| `display` | Force the display unit (`cm`/`in`) |
| `ar=1` | Open the AR view straight away |

With no `img`, a sample painting is shown.

## Setting it up on Wix

See **[docs/WIX_SETUP.md](docs/WIX_SETUP.md)** for step-by-step instructions: hosting on GitHub Pages, adding a "View on your wall" button to Wix Stores product pages (automatic, using [wix/product-page.js](wix/product-page.js)), or embedding the viewer in a page.

## Customising

Edit [`js/config.js`](js/config.js) to set your gallery name, default unit, frame styles and colours, mat options, and the reference objects offered for measuring. Colours and fonts are CSS variables at the top of [`css/styles.css`](css/styles.css).

## Development

```bash
npm start    # serves the site at http://localhost:8080
npm test     # unit tests (perspective maths, 3D model generation)
```

| File | Purpose |
|---|---|
| `index.html`, `css/styles.css` | Page and layout (responsive, works on phones) |
| `js/app.js` | Main app: photo upload, scale measuring, dragging, rendering, export, AR |
| `js/geometry.js` | Homography (perspective) maths and image warping |
| `js/framing.js` | Draws the artwork with its frame and mat |
| `js/glb.js` | Builds the real-size 3D model (GLB) used for AR |
| `js/samples.js` | Built-in sample room and sample artwork |
| `js/config.js` | Gallery settings |
| `wix/product-page.js` | Velo code for Wix Stores product pages |

**Privacy:** visitors' wall photos never leave their device. Everything is processed in the browser.
