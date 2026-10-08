# Adding Room Viewer to your Wix site

The viewer is a small static website. Host it once, then link to it or embed it from any Wix page.

## 1. Host the viewer (GitHub Pages, free)

1. On GitHub, open this repository → **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, select your main branch and the `/ (root)` folder, then **Save**.
3. After a minute your viewer is live at `https://YOUR-GITHUB-USERNAME.github.io/Room-Viewer/`.
4. Open that address to check it: you should see the sample room and sample painting.

Before going live, set your gallery name in `js/config.js` (`galleryName`).

> Any static host works (Netlify, Cloudflare Pages, your own server). It must be served over **HTTPS**, because phones only allow the camera and AR on secure pages.

## 2. Connect it to your artworks

Choose one of these options.

### Option A: automatic button on every product page (Wix Stores + Velo), recommended

This adds a **View on your wall** button to chosen product pages, using each product's image and the sizes written in its description.

1. In the Wix Editor, turn on **Dev Mode** (top menu → *Dev Mode* → *Turn on Dev Mode*).
2. Open your **Product Page** (Pages → Shop Pages → Product Page). This one page is the template for every product.
3. Add a **Button** near the Add to Cart button. Label it *View on your wall*. In the Properties panel:
   - set its ID to `roomViewButton`
   - tick **Hidden on load**, so it never flashes up on products that don't have the viewer yet.
4. Check that the product element's ID is `productPage1` (click it and look in the Properties panel). If it's different, change it in the code.
5. Open the page's code panel and paste in the contents of [`wix/product-page.js`](../wix/product-page.js). `VIEWER_URL` and `siteBase()` at the top are already set for this site.
6. **Which products show the button**: `ENABLED_PRODUCT_SLUGS` lists them by the end of their web address (`/product-page/exit-eden` → `'exit-eden'`). It's currently set to Young Hearts, Narcissistic Bathers and Exit Eden. Add more to roll it out; an empty list `[]` shows it on every product.
7. **Sizes**: the code reads the product description, so keep these lines in it, as on the current products:
   - `Image size: 39 x 30.7 cm`
   - `Mount size: 61.5 x 52 cm`
   - `Framed size: 71.7 x 62.4 cm` (here, or in an additional info section)

   Height and width can be in either order; the code matches them to the picture's shape. Without an image size the viewer can't show true size and says so.
8. **Preview**, open each enabled product, click the button and check the print appears at the right size. Then **Publish**.

### Option B: a link per artwork (no code)

Add a button or text link to any page and point it at a viewer URL with the artwork's details, for example:

```
https://YOUR-GITHUB-USERNAME.github.io/Room-Viewer/?img=IMAGE_URL&title=Evening%20Field&artist=A.%20Painter&w=60&h=80&unit=cm
```

To get `IMAGE_URL` in Wix: open the Media Manager, select the image, and copy its URL (`https://static.wixstatic.com/media/...`). See the main README for all the URL options.

### Option C: embed the viewer in a page

1. Add an **Embed → Embed a site** element (or **Embed HTML** → *Website address*).
2. Paste a viewer URL (as in Option B) and stretch the element. At least **900 × 700 px** works well on desktop. On mobile, make it full width and about 1100 px tall.
3. In Dev Mode, if you set the HTML element's ID to `roomViewer` on a product page, the code from Option A also sends it the product's artwork automatically.

Phones block AR inside embedded frames, so in embedded mode the **View in AR** button opens the viewer in a new tab, where AR works normally.

## Tips for your visitors (consider adding to your FAQ)

- Photograph the wall **straight on**, from about 2–3 m away, with the camera at about chest height.
- For an accurate size, measure something **on the same wall**: the height of a door, a light switch plate, or a sheet of A4/Letter paper taped to the wall.
- Use **Adjust perspective** when the wall was photographed at an angle.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Image host doesn't allow downloads or AR" | The image URL doesn't send CORS headers. Use the `static.wixstatic.com` URL of the image, or host the image somewhere that does. |
| No AR button on phone | iPhone needs iOS 12+ in Safari; Android needs Chrome and an [ARCore-supported device](https://developers.google.com/ar/devices). |
| Artwork looks the wrong size | The visitor hasn't measured yet (the scale badge says *Estimated*). Prompt them to use **Measure a reference object**. |
