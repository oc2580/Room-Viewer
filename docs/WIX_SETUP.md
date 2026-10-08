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

This adds a **View on your wall** button to every product, using the product's image and its size options.

1. In the Wix Editor, turn on **Dev Mode** (top menu → *Dev Mode* → *Turn on Dev Mode*).
2. Open your **Product Page** (Pages → Shop Pages → Product Page).
3. Add a **Button** near the Add to Cart button. Label it *View on your wall*. In the Properties panel, set its ID to `roomViewButton`.
4. Check that the product element's ID is `productPage1` (click it and look in the Properties panel). If it's different, change it in the code.
5. Open the page's code panel and paste in the contents of [`wix/product-page.js`](../wix/product-page.js).
6. Edit the two lines at the top of the code:
   - `VIEWER_URL`: your GitHub Pages address from step 1.
   - `siteBase()`: your site's domain, for the *Back to artwork* link.
7. **Sizes**: the code reads sizes from your product options. Name the choices like `40 x 50 cm`, `60 x 80 cm` (or `16 x 20 in` with `DEFAULT_UNIT = 'in'`). Products with no size options still work, but the viewer will say the size isn't specified, so add at least one size.
8. Preview, click the button, and check the artwork appears at the right size. Then **Publish**.

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
