const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { createCanvas, loadImage } = require('canvas');

const app = express();
app.use(cors());

const API_BASE = 'https://api.sooq-com.com';
const MAIN_SITE = 'https://sooq-com.com';
const SHARE_DOMAIN = 'https://share.sooq-com.com';

// ==========================================
// 1. DYNAMIC HTML ENDPOINT (Returns OG Tags)
// ==========================================
app.get('/ad/:id', async (req, res) => {
    const { id } = req.params;
    
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
        const redirectUrl = `${MAIN_SITE}/ad/${id}`;

        const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${redirectUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${redirectUrl}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${imageUrl}">

    <!-- Redirect Real Users immediately -->
    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
    <script>
        window.location.replace("${redirectUrl}");
    </script>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px;">
    <h2>جاري تحويلك إلى الإعلان...</h2>
    <p><a href="${redirectUrl}">انقر هنا إذا لم يتم تحويلك تلقائياً</a></p>
</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error(`Failed to fetch ad ${id} for HTML:`, error.message);
        // Fallback gracefully: redirect user to the website anyway
        res.redirect(`${MAIN_SITE}/ad/${id}`);
    }
});

app.get('/category/:id', async (req, res) => {
    const { id } = req.params;
    
    // We get query params so we can pass them along (e.g. filters)
    const queryString = req.url.substring(req.url.indexOf('?'));
    const redirectUrl = `${MAIN_SITE}/category/${id}${queryString !== req.url ? queryString : ''}`;
    
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
    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
    <script>window.location.replace("${redirectUrl}");</script>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px;">
    <h2>جاري تحويلك...</h2>
    <p><a href="${redirectUrl}">انقر هنا</a></p>
</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error(`Failed to fetch cat ${id} for HTML:`, error.message);
        res.redirect(redirectUrl);
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
        const images = ad.images || []; // Expecting an array of URL strings

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
        
        // Fallback: Send empty white canvas to prevent breaking the request
        const emptyCanvas = createCanvas(1200, 630);
        const ctx = emptyCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1200, 630);
        res.setHeader('Content-Type', 'image/jpeg');
        emptyCanvas.createJPEGStream().pipe(res);
    }
});

app.get('/image/category/:id.jpg', async (req, res) => {
    const { id } = req.params;
    
    try {
        const response = await axios.get(`${API_BASE}/categories/${id}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        const cat = response.data.data || response.data;
        const iconUrl = cat.icon || cat.image;

        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#f0f2f5';
        ctx.fillRect(0, 0, 1200, 630);

        if (iconUrl) {
            try {
                const img = await loadImage(iconUrl);
                // Draw icon centered
                const size = 300;
                ctx.drawImage(img, 600 - (size/2), 315 - (size/2), size, size);
            } catch(e) {}
        }
        
        ctx.fillStyle = '#00B2FF';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(cat.name || 'سوقكم', 600, 480);

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=604800'); 
        canvas.createJPEGStream({ quality: 0.9 }).pipe(res);
        
    } catch (error) {
        console.error(`Failed to generate image for cat ${id}:`, error.message);
        const emptyCanvas = createCanvas(1200, 630);
        res.setHeader('Content-Type', 'image/jpeg');
        emptyCanvas.createJPEGStream().pipe(res);
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
app.listen(PORT, () => {
    console.log(`✅ Sooqcom OG Image Service is running on port ${PORT}`);
    console.log(`Test HTML Endpoint: http://localhost:${PORT}/ad/123`);
    console.log(`Test Image Endpoint: http://localhost:${PORT}/image/123.jpg`);
});
