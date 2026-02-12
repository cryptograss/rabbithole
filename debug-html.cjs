const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:4000/pickipedia-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  const html = await page.evaluate(() => {
    const card = document.querySelector('.musician-item.musician-card');
    return card ? card.outerHTML : 'Not found';
  });

  console.log('Musician card HTML:', html);
  await browser.close();
})();
