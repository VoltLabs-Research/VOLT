import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/atoms') && !url.includes('.js')) {
        console.log(`[ATOMS ${response.status()}] ${url}`);
    }
});

try {
    console.log('Login...');
    await page.goto('http://192.168.101.98:5273/auth/sign-in', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'contact@rodyherrera.com');
    await page.click('button:has-text("Continue with Email")');
    await page.waitForSelector('input[type="password"]');
    await page.fill('input[type="password"]', '55563019');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 60000 });
    console.log('Logged in');
    await page.waitForTimeout(2000);
    
    // Use search to find Shear Deformation
    console.log('Searching for Shear...');
    await page.fill('input[placeholder*="Search"]', 'Shear');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/volt-search.png' });
    
    // Click on first result
    const result = page.locator('text=Shear').first();
    if (await result.isVisible({ timeout: 5000 }).catch(() => false)) {
        await result.click();
        console.log('Clicked search result');
        await page.waitForTimeout(5000);
        console.log('URL:', page.url());
        await page.screenshot({ path: '/tmp/volt-shear.png' });
        
        // Look for PTM
        console.log('Looking for PTM...');
        const ptm = page.locator('text=Polyhedral Template Matching').first();
        if (await ptm.isVisible({ timeout: 10000 }).catch(() => false)) {
            await ptm.click();
            console.log('Clicked PTM');
            await page.waitForTimeout(3000);
        }
        await page.screenshot({ path: '/tmp/volt-ptm.png' });
        
        // Click Particles tab
        console.log('Looking for Particles tab...');
        const particles = page.locator('button:has-text("Particles"), [role="tab"]:has-text("Particles")').first();
        if (await particles.isVisible({ timeout: 5000 }).catch(() => false)) {
            await particles.click();
            console.log('Clicked Particles');
        }
        
        await page.waitForTimeout(15000);
        await page.screenshot({ path: '/tmp/volt-particles.png' });
    } else {
        console.log('No results found');
    }
    
    console.log('Done!');
    
} catch (e) {
    console.error('Error:', e.message);
    await page.screenshot({ path: '/tmp/volt-error.png' });
} finally {
    await browser.close();
}
