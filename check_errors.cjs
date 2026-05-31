const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
    
    console.log('Navigating to http://localhost:8081/');
    await page.goto('http://localhost:8081/', { waitUntil: 'networkidle0', timeout: 10000 });
    
    console.log('Page loaded. Check the logs above for browser console errors.');
    await browser.close();
  } catch (err) {
    console.error('Puppeteer error:', err);
  }
})();
