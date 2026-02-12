const { chromium } = require('playwright');

const viewports = [
  { name: 'iphone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1200, height: 800 }
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = 'http://localhost:4000/pickipedia-demo.html';

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000); // Let everything load including dynamic content

    // Expanded state
    await page.screenshot({
      path: `/home/magent/workspace/rabbithole/screenshots/${vp.name}-expanded.png`,
      fullPage: true
    });
    console.log(`Captured ${vp.name} expanded`);

    // Click minimize button
    await page.click('.minimize-btn');
    await page.waitForTimeout(500);

    // Minimized state
    await page.screenshot({
      path: `/home/magent/workspace/rabbithole/screenshots/${vp.name}-minimized.png`,
      fullPage: false
    });
    console.log(`Captured ${vp.name} minimized`);
  }

  await browser.close();
  console.log('Done! Screenshots saved to /home/magent/workspace/rabbithole/screenshots/');
})();
