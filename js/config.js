// Gallery-wide settings. Edit this file to brand the viewer for your gallery.
export const CONFIG = {
  galleryName: 'Jack Vettriano Studio',
  // Shown in the header. Leave empty to hide.
  galleryUrl: 'https://www.jackvettriano.studio/',
  // Default display unit for visitors: 'cm' or 'in'.
  defaultUnit: 'cm',
  // Add a small caption strip (title, size, gallery) to downloaded mockups.
  captionOnDownload: true,
  // Default frame for artworks that don't specify one: a key of FRAMES.
  defaultFrame: 'none',
  // Width of the visible wall assumed until the visitor measures something (cm).
  assumedWallWidthCm: 300,
};

// Frame styles. width/depth are in cm; depth is how far the piece sticks out
// from the wall (used for the shadow and the AR model).
export const FRAMES = {
  none: { label: 'Unframed', width: 0, depth: 2, color: null },
  black: { label: 'Black', width: 2.5, depth: 3.5, color: '#1d1d1d' },
  white: { label: 'White', width: 2.5, depth: 3.5, color: '#f3f1ec' },
  oak: { label: 'Oak', width: 3, depth: 3.5, color: '#b88d5c', grain: true },
  walnut: { label: 'Walnut', width: 3, depth: 3.5, color: '#5b3d2a', grain: true },
  gold: { label: 'Gold', width: 3.5, depth: 4, color: '#b8963f', metallic: true },
  // Publisher's frame for Jack Vettriano editions: black with a thin gold inner slip.
  publisher: { label: 'Black with gold slip', width: 5.2, depth: 4, color: '#161514', slip: { color: '#c3a052', width: 0.5 } },
};

export const MATS = [
  { label: 'No mount', width: 0 },
  { label: 'Slim mount (5 cm)', width: 5 },
  { label: 'Wide mount (8 cm)', width: 8 },
];

// Objects visitors can measure in their photo to set the scale (lengths in cm).
export const REFERENCES = [
  { label: 'Interior door – height', cm: 203.2 },
  { label: 'Interior door – width', cm: 81.3 },
  { label: 'Light switch plate – height', cm: 11.4 },
  { label: 'Electrical outlet plate – height', cm: 11.4 },
  { label: 'A4 sheet of paper – long side', cm: 29.7 },
  { label: 'US Letter paper – long side', cm: 27.94 },
  { label: 'Sofa – seat height (typical)', cm: 45 },
  { label: 'Something I measured myself', cm: null },
];
