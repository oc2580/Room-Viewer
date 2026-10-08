// Bumps the ?v= cache-busting number on the stylesheet and scripts so
// visitors' browsers load the new files straight after a deploy.
// Usage: npm run bump
import fs from 'node:fs';

const files = ['index.html', 'js/app.js'];
const current = Math.max(...files.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/\?v=(\d+)/g)].map((m) => +m[1])));
const next = current + 1;
for (const f of files) {
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\?v=\d+/g, `?v=${next}`));
}
console.log(`Version ${current} -> ${next}`);
