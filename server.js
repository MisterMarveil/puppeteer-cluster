const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '5mb' }));

const API_KEY = process.env.PDF_API_KEY || '';

app.post('/render-pdf', async (req, res) => {
    if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { htmlPath, outputPath, orientation, paperSize } = req.body;

    if (!htmlPath || !outputPath) {
        return res.status(400).json({ error: 'htmlPath and outputPath are required' });
    }

    let _landscape = !orientation ? false : !(orientation == 'Portrait' || orientation.startsWith('P') || orientation.startsWith('p'));
    let _size =  paperSize ?  paperSize : 'A3';

    if (!htmlPath.startsWith('/app/tmp/') || !outputPath.startsWith('/app/tmp/')) {
        return res.status(400).json({ error: 'Invalid path' });
    }

    if (!fs.existsSync(htmlPath)) {
        return res.status(404).json({ error: 'HTML file not found' });
    }

    let browser;

    try {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            headless: 'new' // Utiliser le nouveau headless
        });

        const page = await browser.newPage();
        
        // Configurer la page pour mieux gérer les backgrounds
/*        await page.setViewport({
            width: 1240,
            height: 1754,
            deviceScaleFactor: 2 // Augmenter la résolution
        });*/

        // Activer les backgrounds avant de charger la page
        await page.emulateMediaType('screen');
        
        // Lire le contenu HTML
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Configurer le content security policy pour permettre les data URLs
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Attendre que les éléments soient rendus
        await page.waitForSelector('.page');
        
        // Prendre une capture pour debug
        await page.screenshot({ path: outputPath.replace('.pdf', '.png'), fullPage: true });

        // Générer le PDF avec plus d'options
        await page.pdf({
            path: outputPath,
            format: _size,
            printBackground: true,
            preferCSSPageSize: false,
            margin: {
                top: '0mm',
                bottom: '0mm',
                left: '0mm',
                right: '0mm',
            },
            displayHeaderFooter: false,
            scale: 1,
            landscape: _landscape,
            timeout: 120000
        });

        console.log(`✅ PDF généré: ${outputPath}`);
        res.json({ 
            status: 'ok', 
            pdf: outputPath,
            preview: outputPath.replace('.pdf', '.png')
        });

    } catch (err) {
        console.error('❌ Erreur:', err);
        res.status(500).json({ 
            error: err.message,
            stack: err.stack 
        });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 3006;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Puppeteer PDF service listening on port ${PORT}`);
});
