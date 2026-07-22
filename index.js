const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { createCanvas, loadImage } = require('canvas');

const app = express();
app.use(cors());

const API_BASE = 'https://api.sooq-com.com/api';
const MAIN_SITE = 'https://sooq-com.com';
const SHARE_DOMAIN = 'https://share.sooq-com.com';

// Detect if the request is from a social media crawler
function isBot(userAgent) {
    if (!userAgent) return false;
    const bots = [
        'facebookexternalhit',
        'WhatsApp',
        'Twitterbot',
        'LinkedInBot',
        'Pinterest',
        'SkypeUriPreview',
        'TelegramBot',
        'Viber',
        'Discordbot',
        'Slackbot'
    ];
    return bots.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
}

// ==========================================
// 0. DEEP LINK VERIFICATION
// ==========================================

// Android App Links verification
app.get('/.well-known/assetlinks.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(`[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.sooqcom.app",
      "sha256_cert_fingerprints": [
        "11:06:17:93:E6:52:6B:76:C6:4D:F0:E2:BB:6B:B1:33:DC:71:0D:46:2D:0F:7C:4A:A1:35:20:4B:40:70:4F:57",
        "C0:A8:DE:BD:FC:F6:16:08:74:7F:E2:BD:06:79:33:49:F6:9B:73:8F:84:1B:2C:82:A3:EE:08:AA:6E:41:08:9B"
      ]
    }
  }
]`);
});

// iOS Universal Links verification
app.get(['/.well-known/apple-app-site-association', '/apple-app-site-association'], (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(JSON.stringify({
        "applinks": {
            "details": [
                {
                    "appIDs": ["6V3SN6YU5G.com.sooqcom.app"],
                    "components": [
                        { "/": "/ad/*", "comment": "Ad deep links" },
                        { "/": "/category/*", "comment": "Category deep links" }
                    ]
                }
            ]
        },
        "webcredentials": {
            "apps": ["6V3SN6YU5G.com.sooqcom.app"]
        }
    }));
});

// ==========================================
// 1. DYNAMIC HTML ENDPOINT (Returns OG Tags)
// ==========================================
app.get('/ad/:id', async (req, res) => {
    const { id } = req.params;
    const userAgent = req.headers['user-agent'];
    const hasQuery = req.url.includes('?');
    const queryString = hasQuery ? req.url.substring(req.url.indexOf('?')) : '';
    const redirectUrl = `${MAIN_SITE}/ad/${id}${queryString}`;
    
    // If it's a real user, instantly redirect them!
    if (!isBot(userAgent)) {
        // Facebook/Messenger/Instagram WebView on Android does NOT honor Android App Links.
        // We use multiple fallback methods to maximize compatibility.
        if (userAgent.toLowerCase().includes('android') && 
            (userAgent.toLowerCase().includes('fb') || userAgent.toLowerCase().includes('messenger') || userAgent.toLowerCase().includes('instagram'))) {
            const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.sooqcom.app';
            const deepLinkPath = `ad/${id}${queryString}`;
            const customSchemeUrl = `sooqcom://${deepLinkPath}`;
            const intentUrl = `intent://${deepLinkPath}#Intent;scheme=sooqcom;package=com.sooqcom.app;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
            
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>جاري فتح التطبيق...</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0a1628 0%,#1a3a5c 100%);color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;direction:rtl}.container{padding:2rem}.logo{width:80px;height:80px;margin:0 auto 1.5rem;background:#00B2FF;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:#fff}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#8899aa;margin-bottom:1.5rem;font-size:0.95rem}.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:#00B2FF;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1.5rem}@keyframes spin{to{transform:rotate(360deg)}}#fallback{display:none;margin-top:2rem}#fallback a{color:#00B2FF;text-decoration:none;font-size:0.85rem}</style></head>
<body><div class="container">
<div class="logo">S</div>
<div class="spinner"></div>
<h1>جاري فتح سوقكم...</h1>
<p>سيتم فتح الإعلان في التطبيق</p>
<div id="fallback"><a href="${intentUrl}">اضغط هنا إذا لم يفتح التطبيق تلقائياً</a></div>
</div>
<script>
// Method 1: Try custom scheme via hidden iframe (works in some WebViews)
try{var f=document.createElement('iframe');f.style.display='none';f.src='${customSchemeUrl}';document.body.appendChild(f)}catch(e){}
// Method 2: Try intent:// via window.location (works in Chrome Custom Tabs)
setTimeout(function(){try{window.location.href='${intentUrl}'}catch(e){}},300);
// Method 3: Show manual link after 3 seconds if nothing worked
setTimeout(function(){document.getElementById('fallback').style.display='block';document.querySelector('.spinner').style.display='none'},3000);
</script></body></html>`;
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
        }
        // iOS Facebook/Messenger/Instagram WebView
        if (userAgent.toLowerCase().includes('iphone') && 
            (userAgent.toLowerCase().includes('fb') || userAgent.toLowerCase().includes('messenger') || userAgent.toLowerCase().includes('instagram'))) {
            const appStoreUrl = 'https://apps.apple.com/app/sooqcom/id6740043498';
            const deepLinkPath = `ad/${id}${queryString}`;
            const customSchemeUrl = `sooqcom://${deepLinkPath}`;
            // Universal Link URL - must be the share domain (where AASA is hosted)
            const universalLinkUrl = `${SHARE_DOMAIN}/ad/${id}${queryString}`;
            
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>فتح في سوقكم</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0a1628 0%,#1a3a5c 100%);color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;direction:rtl}.container{padding:2rem;max-width:400px}.logo{width:80px;height:80px;margin:0 auto 1.5rem;background:#00B2FF;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:#fff}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#8899aa;margin-bottom:1.5rem;font-size:0.95rem}.btn{display:block;width:100%;padding:16px;border-radius:12px;font-size:1.1rem;font-weight:bold;text-decoration:none;margin-bottom:12px;text-align:center}.btn-primary{background:#00B2FF;color:#fff}.btn-secondary{background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2)}.btn-store{background:#fff;color:#333;font-size:0.9rem}</style></head>
<body><div class="container">
<div class="logo">S</div>
<h1>سوقكم - Sooqcom</h1>
<p>لفتح الإعلان في التطبيق، اضغط الزر أدناه</p>
<a href="${customSchemeUrl}" class="btn btn-primary">📱 فتح في التطبيق</a>
<a href="${universalLinkUrl}" target="_blank" class="btn btn-secondary">🌐 فتح في المتصفح</a>
<a href="${appStoreUrl}" class="btn btn-store">⬇️ تحميل التطبيق من App Store</a>
</div></body></html>`;
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
        }
        return res.redirect(302, redirectUrl);
    }
    
    try {
        // Fetch ad details securely
        const response = await axios.get(`${API_BASE}/ads/${id}`, {
            headers: {
                'Accept': 'application/json',
                // Add any necessary authorization headers here if the API requires it
            }
        });
        
        // Handle different possible API response structures
        const ad = response.data.data || response.data.ad || response.data;
        const title = ad.title || 'إعلان على سوقكم';
        const description = ad.description || 'شاهد تفاصيل هذا الإعلان على موقع سوقكم';
        
        const imageUrl = `${SHARE_DOMAIN}/image/${id}.jpg`;

        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta property="og:type" content="website">
    <meta property="og:url" content="${redirectUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${redirectUrl}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${imageUrl}">
    
    <!-- Native Facebook App Links -->
    <meta property="al:android:url" content="sooqcom://ad/${id}${queryString}">
    <meta property="al:android:package" content="com.sooqcom.app">
    <meta property="al:android:app_name" content="Sooqcom">
    <meta property="al:ios:url" content="sooqcom://ad/${id}${queryString}">
    <meta property="al:ios:app_store_id" content="6740043498">
    <meta property="al:ios:app_name" content="Sooqcom">
    <meta property="al:web:should_fallback" content="false">
</head>
<body></body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error(`Failed to fetch ad ${id} for HTML:`, error.message);
        // Fallback: Return generic HTML so Messenger still unfurls it
        const title = 'إعلان على سوقكم';
        const description = 'شاهد تفاصيل هذا الإعلان على موقع سوقكم';
        const imageUrl = `${SHARE_DOMAIN}/image/${id}.jpg`;
        const redirectUrl = `${MAIN_SITE}/ad/${id}`;
        
        const fallbackHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta property="og:type" content="website">
    <meta property="og:url" content="${redirectUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    
    <!-- Native Facebook App Links -->
    <meta property="al:android:url" content="sooqcom://ad/${id}${queryString}">
    <meta property="al:android:package" content="com.sooqcom.app">
    <meta property="al:android:app_name" content="Sooqcom">
    <meta property="al:ios:url" content="sooqcom://ad/${id}${queryString}">
    <meta property="al:ios:app_store_id" content="6740043498">
    <meta property="al:ios:app_name" content="Sooqcom">
    <meta property="al:web:should_fallback" content="false">
</head>
<body></body>
</html>
        `;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(fallbackHtml);
    }
});

app.get('/category/:id', async (req, res) => {
    const { id } = req.params;
    const userAgent = req.headers['user-agent'];
    
    // We get query params so we can pass them along (e.g. filters)
    const hasQuery = req.url.includes('?');
    const queryString = hasQuery ? req.url.substring(req.url.indexOf('?')) : '';
    const redirectUrl = `${MAIN_SITE}/category/${id}${queryString}`;
    
    // If it's a real user, instantly redirect them!
    if (!isBot(userAgent)) {
        // Facebook/Messenger/Instagram WebView on Android does NOT honor Android App Links.
        // We use multiple fallback methods to maximize compatibility.
        if (userAgent.toLowerCase().includes('android') && 
            (userAgent.toLowerCase().includes('fb') || userAgent.toLowerCase().includes('messenger') || userAgent.toLowerCase().includes('instagram'))) {
            const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.sooqcom.app';
            const deepLinkPath = `category/${id}${queryString}`;
            const customSchemeUrl = `sooqcom://${deepLinkPath}`;
            const intentUrl = `intent://${deepLinkPath}#Intent;scheme=sooqcom;package=com.sooqcom.app;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
            
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>جاري فتح التطبيق...</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0a1628 0%,#1a3a5c 100%);color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;direction:rtl}.container{padding:2rem}.logo{width:80px;height:80px;margin:0 auto 1.5rem;background:#00B2FF;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:#fff}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#8899aa;margin-bottom:1.5rem;font-size:0.95rem}.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:#00B2FF;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1.5rem}@keyframes spin{to{transform:rotate(360deg)}}#fallback{display:none;margin-top:2rem}#fallback a{color:#00B2FF;text-decoration:none;font-size:0.85rem}</style></head>
<body><div class="container">
<div class="logo">S</div>
<div class="spinner"></div>
<h1>جاري فتح سوقكم...</h1>
<p>سيتم فتح القسم في التطبيق</p>
<div id="fallback"><a href="${intentUrl}">اضغط هنا إذا لم يفتح التطبيق تلقائياً</a></div>
</div>
<script>
// Method 1: Try custom scheme via hidden iframe (works in some WebViews)
try{var f=document.createElement('iframe');f.style.display='none';f.src='${customSchemeUrl}';document.body.appendChild(f)}catch(e){}
// Method 2: Try intent:// via window.location (works in Chrome Custom Tabs)
setTimeout(function(){try{window.location.href='${intentUrl}'}catch(e){}},300);
// Method 3: Show manual link after 3 seconds if nothing worked
setTimeout(function(){document.getElementById('fallback').style.display='block';document.querySelector('.spinner').style.display='none'},3000);
</script></body></html>`;
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
        }
        // iOS Facebook/Messenger/Instagram WebView
        if (userAgent.toLowerCase().includes('iphone') && 
            (userAgent.toLowerCase().includes('fb') || userAgent.toLowerCase().includes('messenger') || userAgent.toLowerCase().includes('instagram'))) {
            const appStoreUrl = 'https://apps.apple.com/app/sooqcom/id6740043498';
            const deepLinkPath = `category/${id}${queryString}`;
            const customSchemeUrl = `sooqcom://${deepLinkPath}`;
            
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>جاري فتح التطبيق...</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0a1628 0%,#1a3a5c 100%);color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;direction:rtl}.container{padding:2rem}.logo{width:80px;height:80px;margin:0 auto 1.5rem;background:#00B2FF;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:#fff}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#8899aa;margin-bottom:1.5rem;font-size:0.95rem}.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top-color:#00B2FF;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1.5rem}@keyframes spin{to{transform:rotate(360deg)}}#fallback{display:none;margin-top:2rem}#fallback a{color:#00B2FF;text-decoration:none;font-size:0.85rem}</style></head>
<body><div class="container">
<div class="logo">S</div>
<div class="spinner"></div>
<h1>جاري فتح سوقكم...</h1>
<p>سيتم فتح القسم في التطبيق</p>
<div id="fallback"><a href="${appStoreUrl}">اضغط هنا إذا لم يفتح التطبيق تلقائياً</a></div>
</div>
<script>
// Try custom scheme on iOS
window.location.href='${customSchemeUrl}';
// Show fallback after 3 seconds
setTimeout(function(){document.getElementById('fallback').style.display='block';document.querySelector('.spinner').style.display='none'},3000);
</script></body></html>`;
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
        }
        return res.redirect(302, redirectUrl);
    }
    
    try {
        const response = await axios.get(`${API_BASE}/categories/${id}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        const cat = response.data.data || response.data;
        const title = cat.name || 'قسم على سوقكم';
        const description = 'تصفح الإعلانات في هذا القسم على سوقكم';
        
        const imageUrl = `${SHARE_DOMAIN}/image/category/${id}.jpg`;

        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta property="og:type" content="website">
    <meta property="og:url" content="${redirectUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    
    <!-- Native Facebook App Links -->
    <meta property="al:android:url" content="sooqcom://category/${id}${queryString}">
    <meta property="al:android:package" content="com.sooqcom.app">
    <meta property="al:android:app_name" content="Sooqcom">
    <meta property="al:ios:url" content="sooqcom://category/${id}${queryString}">
    <meta property="al:ios:app_store_id" content="6740043498">
    <meta property="al:ios:app_name" content="Sooqcom">
    <meta property="al:web:should_fallback" content="false">
</head>
<body></body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error(`Failed to fetch cat ${id} for HTML:`, error.message);
        // Fallback generic HTML
        const title = 'قسم على سوقكم';
        const description = 'تصفح الإعلانات في هذا القسم على سوقكم';
        const imageUrl = `${SHARE_DOMAIN}/image/category/${id}.jpg`;
        
        const fallbackHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta property="og:type" content="website">
    <meta property="og:url" content="${redirectUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    
    <!-- Native Facebook App Links -->
    <meta property="al:android:url" content="sooqcom://category/${id}${queryString}">
    <meta property="al:android:package" content="com.sooqcom.app">
    <meta property="al:android:app_name" content="Sooqcom">
    <meta property="al:ios:url" content="sooqcom://category/${id}${queryString}">
    <meta property="al:ios:app_store_id" content="6740043498">
    <meta property="al:ios:app_name" content="Sooqcom">
    <meta property="al:web:should_fallback" content="false">
</head>
<body></body>
</html>
        `;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(fallbackHtml);
    }
});

// ==========================================
// 2. DYNAMIC IMAGE GENERATOR (2x2 Collage)
// ==========================================
app.get('/image/:id.jpg', async (req, res) => {
    const { id } = req.params;
    
    try {
        const response = await axios.get(`${API_BASE}/ads/${id}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        const ad = response.data.data || response.data.ad || response.data;
        
        let images = [];
        if (ad.attributes && Array.isArray(ad.attributes.images) && ad.attributes.images.length > 0) {
            images = ad.attributes.images;
        } else if (ad.image_urls && Array.isArray(ad.image_urls) && ad.image_urls.length > 0) {
            images = ad.image_urls;
        } else if (ad.image_url && typeof ad.image_url === 'string') {
            try {
                images = JSON.parse(ad.image_url);
            } catch (e) {
                images = [ad.image_url];
            }
        }

        // Standard Open Graph Image Size: 1200x630
        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        
        // Fill background with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1200, 630);

        if (images.length === 0) {
            // Draw a placeholder if no images exist
            ctx.fillStyle = '#f0f2f5';
            ctx.fillRect(0, 0, 1200, 630);
            ctx.fillStyle = '#00B2FF';
            ctx.font = 'bold 80px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('سوقكم - Sooqcom', 600, 315);
        } else {
            // Fetch top 4 images max
            const numToDraw = Math.min(images.length, 4);
            const loadedImages = [];
            
            for (let i = 0; i < numToDraw; i++) {
                try {
                    // Extract URL if it's an object, otherwise use string
                    const imgUrl = typeof images[i] === 'string' ? images[i] : images[i].url || images[i].path;
                    if (imgUrl) loadedImages.push(await loadImage(imgUrl));
                } catch (e) {
                    console.error('Failed to load image part:', e.message);
                }
            }

            // Draw Collage Logic
            const padding = 10;
            if (loadedImages.length === 1) {
                drawImageCover(ctx, loadedImages[0], 0, 0, 1200, 630);
            } else if (loadedImages.length === 2) {
                const w = (1200 - padding) / 2;
                drawImageCover(ctx, loadedImages[0], 0, 0, w, 630);
                drawImageCover(ctx, loadedImages[1], w + padding, 0, w, 630);
            } else if (loadedImages.length === 3) {
                const w = (1200 - padding) / 2;
                const h = (630 - padding) / 2;
                drawImageCover(ctx, loadedImages[0], 0, 0, w, 630);
                drawImageCover(ctx, loadedImages[1], w + padding, 0, w, h);
                drawImageCover(ctx, loadedImages[2], w + padding, h + padding, w, h);
            } else if (loadedImages.length >= 4) {
                const w = (1200 - padding) / 2;
                const h = (630 - padding) / 2;
                drawImageCover(ctx, loadedImages[0], 0, 0, w, h);
                drawImageCover(ctx, loadedImages[1], w + padding, 0, w, h);
                drawImageCover(ctx, loadedImages[2], 0, h + padding, w, h);
                drawImageCover(ctx, loadedImages[3], w + padding, h + padding, w, h);
            }
        }

        // Return the JPEG image directly
        res.setHeader('Content-Type', 'image/jpeg');
        // Tell Cloudflare to cache this image heavily! (1 week)
        res.setHeader('Cache-Control', 'public, max-age=604800'); 
        
        const stream = canvas.createJPEGStream({ quality: 0.9 });
        stream.pipe(res);
        
    } catch (error) {
        console.error(`Failed to generate image for ad ${id}:`, error.message);
        
        // Fallback: Send white canvas with text to prevent black square
        const emptyCanvas = createCanvas(1200, 630);
        const ctx = emptyCanvas.getContext('2d');
        ctx.fillStyle = '#f0f2f5';
        ctx.fillRect(0, 0, 1200, 630);
        ctx.fillStyle = '#00B2FF';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('سوقكم - Sooqcom', 600, 315);
        
        res.setHeader('Content-Type', 'image/jpeg');
        emptyCanvas.createJPEGStream({ quality: 0.9 }).pipe(res);
    }
});

app.get('/image/category/:id.jpg', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Fetch top ads for this category
        const response = await axios.get(`${API_BASE}/ads?category_id=${id}&limit=10`, {
            headers: { 'Accept': 'application/json' }
        });
        
        const ads = response.data || [];
        let images = [];
        
        for (const ad of ads) {
            if (images.length >= 4) break;
            
            let adImages = [];
            if (ad.attributes && Array.isArray(ad.attributes.images) && ad.attributes.images.length > 0) {
                adImages = ad.attributes.images;
            } else if (ad.image_urls && Array.isArray(ad.image_urls) && ad.image_urls.length > 0) {
                adImages = ad.image_urls;
            } else if (ad.image_url && typeof ad.image_url === 'string') {
                try {
                    adImages = JSON.parse(ad.image_url);
                } catch (e) {
                    adImages = [ad.image_url];
                }
            }
            
            if (adImages.length > 0) {
                const imgUrl = typeof adImages[0] === 'string' ? adImages[0] : adImages[0].url || adImages[0].path;
                if (imgUrl) images.push(imgUrl);
            }
        }

        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        
        // Fill background with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1200, 630);

        if (images.length === 0) {
            // Fallback to category icon if no ad images found
            try {
                const catRes = await axios.get(`${API_BASE}/categories/${id}`, {
                    headers: { 'Accept': 'application/json' }
                });
                const cat = catRes.data.data || catRes.data;
                const iconUrl = cat.icon || cat.image;

                if (iconUrl) {
                    try {
                        const img = await loadImage(iconUrl);
                        const size = 300;
                        ctx.drawImage(img, 600 - (size/2), 315 - (size/2), size, size);
                    } catch(e) {}
                }
                
                ctx.fillStyle = '#00B2FF';
                ctx.font = 'bold 80px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(cat.name || 'سوقكم', 600, 480);
            } catch (e) {
                ctx.fillStyle = '#f0f2f5';
                ctx.fillRect(0, 0, 1200, 630);
                ctx.fillStyle = '#00B2FF';
                ctx.font = 'bold 80px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('سوقكم', 600, 315);
            }
        } else {
            // Draw collage of ad images
            const numToDraw = Math.min(images.length, 4);
            const loadedImages = [];
            
            for (let i = 0; i < numToDraw; i++) {
                try {
                    loadedImages.push(await loadImage(images[i]));
                } catch (e) {
                    console.error('Failed to load category image part:', e.message);
                }
            }

            const padding = 10;
            if (loadedImages.length === 1) {
                drawImageCover(ctx, loadedImages[0], 0, 0, 1200, 630);
            } else if (loadedImages.length === 2) {
                const w = (1200 - padding) / 2;
                drawImageCover(ctx, loadedImages[0], 0, 0, w, 630);
                drawImageCover(ctx, loadedImages[1], w + padding, 0, w, 630);
            } else if (loadedImages.length === 3) {
                const w = (1200 - padding) / 2;
                const h = (630 - padding) / 2;
                drawImageCover(ctx, loadedImages[0], 0, 0, w, 630);
                drawImageCover(ctx, loadedImages[1], w + padding, 0, w, h);
                drawImageCover(ctx, loadedImages[2], w + padding, h + padding, w, h);
            } else if (loadedImages.length >= 4) {
                const w = (1200 - padding) / 2;
                const h = (630 - padding) / 2;
                drawImageCover(ctx, loadedImages[0], 0, 0, w, h);
                drawImageCover(ctx, loadedImages[1], w + padding, 0, w, h);
                drawImageCover(ctx, loadedImages[2], 0, h + padding, w, h);
                drawImageCover(ctx, loadedImages[3], w + padding, h + padding, w, h);
            }
        }

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=604800'); 
        canvas.createJPEGStream({ quality: 0.9 }).pipe(res);
        
    } catch (error) {
        console.error(`Failed to generate image for cat ${id}:`, error.message);
        const emptyCanvas = createCanvas(1200, 630);
        const ctx = emptyCanvas.getContext('2d');
        ctx.fillStyle = '#f0f2f5';
        ctx.fillRect(0, 0, 1200, 630);
        ctx.fillStyle = '#00B2FF';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('سوقكم', 600, 315);
        
        res.setHeader('Content-Type', 'image/jpeg');
        emptyCanvas.createJPEGStream({ quality: 0.9 }).pipe(res);
    }
});

// Helper: object-fit: cover equivalent for Canvas
function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let renderW, renderH, offsetX = 0, offsetY = 0;

    if (imgRatio > boxRatio) {
        renderH = h;
        renderW = h * imgRatio;
        offsetX = (renderW - w) / 2;
    } else {
        renderW = w;
        renderH = w / imgRatio;
        offsetY = (renderH - h) / 2;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x - offsetX, y - offsetY, renderW, renderH);
    ctx.restore();
}

const PORT = process.env.PORT || 3000;
const BUILD_VERSION = 'v2.0-deeplink-fix-20260722';

// Version endpoint to verify deployment
app.get('/version', (req, res) => {
    res.json({ version: BUILD_VERSION, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✅ Sooqcom OG Image Service ${BUILD_VERSION} is running on port ${PORT}`);
    console.log(`Test HTML Endpoint: http://localhost:${PORT}/ad/123`);
    console.log(`Test Image Endpoint: http://localhost:${PORT}/image/123.jpg`);
    console.log(`AASA Endpoint: http://localhost:${PORT}/.well-known/apple-app-site-association`);
});
