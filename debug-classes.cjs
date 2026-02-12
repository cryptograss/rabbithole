const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:4000/pickipedia-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  const structure = await page.evaluate(() => {
    const webampWrapper = document.querySelector('.webamp-wrapper');
    if (!webampWrapper) return 'No webamp-wrapper found';

    // Find all elements that look like musician cards
    const allDivs = webampWrapper.querySelectorAll('div');
    const classes = new Set();
    allDivs.forEach(d => {
      if (d.className) classes.add(d.className);
    });

    // Get the HTML structure of musician area
    const musicianArea = webampWrapper.querySelector('[class*="ensemble"]') ||
                        webampWrapper.querySelector('[class*="musician"]') ||
                        webampWrapper.querySelector('#webamp');

    return {
      allClasses: Array.from(classes).slice(0, 30),
      webampHTML: webampWrapper.innerHTML.substring(0, 2000)
    };
  });

  console.log('Structure:', JSON.stringify(structure, null, 2));
  await browser.close();
})();
