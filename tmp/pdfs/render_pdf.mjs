import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = '/Users/sirajul/propertybusiness-';
const input = path.join(root, 'tmp/pdfs/user-guide.html');
const output = path.join(root, 'output/pdf/reshmi-enterprise-user-guide-bn.pdf');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage({ viewport: { width: 1403, height: 992 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(input).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => { await document.fonts.ready; });
await page.pdf({ path: output, format: 'A4', landscape: true, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true });
await browser.close();
console.log(output);
