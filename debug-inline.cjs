const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:4000/pickipedia-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  const styles = await page.evaluate(() => {
    const ensemble = document.querySelector('.ensemble-display-in-webamp');
    if (!ensemble) return 'No ensemble found';

    const computed = window.getComputedStyle(ensemble);
    const musicianItems = ensemble.querySelectorAll('.musician-item');

    return {
      ensembleInlineStyle: ensemble.getAttribute('style'),
      ensembleComputedDisplay: computed.display,
      ensembleComputedFlexDirection: computed.flexDirection,
      musicianCount: musicianItems.length,
      firstMusicianInlineStyle: musicianItems[0]?.getAttribute('style'),
      firstMusicianComputedDisplay: window.getComputedStyle(musicianItems[0])?.display
    };
  });

  console.log('Styles:', JSON.stringify(styles, null, 2));
  await browser.close();
})();
