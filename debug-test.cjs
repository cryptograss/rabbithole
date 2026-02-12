const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Test desktop viewport
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('http://localhost:4000/pickipedia-demo.html', { waitUntil: 'networkidle' });

  // Wait longer for player to fully initialize
  await page.waitForTimeout(8000);

  // Check what's in ensemble-display
  const ensembleContent = await page.evaluate(() => {
    const el = document.getElementById('ensemble-display');
    const allMusicianCards = document.querySelectorAll('.musician-card');
    return {
      ensembleInnerHTML: el ? el.innerHTML.substring(0, 500) : 'NOT FOUND',
      ensembleChildCount: el ? el.children.length : 0,
      totalMusicianCards: allMusicianCards.length,
      dataSectionHTML: document.querySelector('.data-section')?.innerHTML.substring(0, 500) || 'NOT FOUND'
    };
  });

  console.log('Desktop content:', JSON.stringify(ensembleContent, null, 2));

  await browser.close();
})();
