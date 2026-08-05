const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

// Lazy table initialization (once per cold start, not every request)
let tableInitialized = false;

// ===== Server-side price calculation for public catalog =====
let cachedDollarRate = null;
let dollarRateFetchedAt = 0;
const DOLLAR_CACHE_MS = 5 * 60 * 1000; // Cache for 5 minutes

async function getServerDollarRate() {
    const now = Date.now();
    if (cachedDollarRate && (now - dollarRateFetchedAt) < DOLLAR_CACHE_MS) {
        return cachedDollarRate;
    }
    try {
        const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        const data = await res.json();
        cachedDollarRate = parseFloat(data.USDBRL.ask);
        dollarRateFetchedAt = now;
        return cachedDollarRate;
    } catch (error) {
        return cachedDollarRate || 5.50;
    }
}

function serverCalculatePrices(priceUSD, url, dollarRate) {
    if (!priceUSD || isNaN(priceUSD) || priceUSD <= 0) {
        return { sn: 'R$ 0,00', nf: 'R$ 0,00', snRaw: 0, nfRaw: 0 };
    }
    var currentDollar = dollarRate || 5.00;
    var snPrice, nfPrice;

    if (url && url.includes('comprasparaguai.com.br')) {
        var specialDollar = currentDollar + 0.20;
        var baseValueBRL = priceUSD * specialDollar;
        snPrice = baseValueBRL * 1.36;
        nfPrice = snPrice * 1.13;
    } else {
        var safeDollar = currentDollar + 0.10;
        var baseValueBRL = priceUSD * safeDollar * 1.113;
        snPrice = baseValueBRL * 1.30;
        nfPrice = snPrice * 1.13;
    }

    var formatCurrency = function(val) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return {
        sn: formatCurrency(snPrice),
        nf: formatCurrency(nfPrice),
        snRaw: Math.round(snPrice * 100) / 100,
        nfRaw: Math.round(nfPrice * 100) / 100
    };
}

// Verify HMAC-SHA256 token
function verifyToken(token, secret) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const payload = parts[0];
    const signature = parts[1];
    const expiration = parseInt(payload, 10);
    if (isNaN(expiration) || Date.now() > expiration) return false;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
    } catch (e) {
        return false;
    }
}

// Derive secret from admin password
function getSecret() {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return null;
    return crypto.createHash('sha256').update(adminPassword + '_catalogodm_secret').digest('hex');
}

// Allowed origins for CORS
function getAllowedOrigins() {
    const origins = ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) origins.push('https://' + vercelUrl);
    const custom = process.env.ALLOWED_ORIGINS;
    if (custom) origins.push.apply(origins, custom.split(',').map(function(o) { return o.trim(); }));
    return origins;
}

// Input validation constants
const MAX_NAME_LENGTH = 500;
const MAX_URL_LENGTH = 2000;
const MAX_BRAND_LENGTH = 200;
const MAX_IMAGE_LENGTH = 2000000;
const VALID_CATEGORIES = ['camera', 'lente', 'cartao', 'flash', 'microfone', 'outro'];

module.exports = async function handler(req, res) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS - restrict to allowed origins
    var allowedOrigins = getAllowedOrigins();
    var origin = req.headers.origin;
    if (origin && allowedOrigins.indexOf(origin) !== -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    var databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        return res.status(500).json({ error: 'Erro interno de configuração' });
    }

    // Auth check for write operations (POST, PUT, DELETE)
    if (['POST', 'PUT', 'DELETE'].indexOf(req.method) !== -1) {
        var secret = getSecret();
        if (!secret) {
            return res.status(500).json({ error: 'Erro interno de configuração' });
        }

        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Autenticação necessária' });
        }

        var token = authHeader.substring(7);
        if (!verifyToken(token, secret)) {
            return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
    }

    var sql = neon(databaseUrl);

    try {
        // Lazy table initialization (once per cold start instead of every request)
        if (!tableInitialized) {
            await sql`
                CREATE TABLE IF NOT EXISTS "Product" (
                    "id" TEXT PRIMARY KEY,
                    "url" TEXT NOT NULL,
                    "name" TEXT NOT NULL,
                    "category" TEXT NOT NULL,
                    "brand" TEXT DEFAULT '',
                    "priceUSD" DOUBLE PRECISION NOT NULL,
                    "image" TEXT NOT NULL,
                    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `;
            tableInitialized = true;
        }

        if (req.method === 'GET') {
            // Public catalog endpoint - returns only safe data with pre-calculated prices
            if (req.query && req.query.catalog === 'true') {
                var dollarRate = await getServerDollarRate();
                var products = await sql`
                    SELECT id, url, name, category, brand, "priceUSD", image
                    FROM "Product"
                    ORDER BY "createdAt" DESC;
                `;
                
                var safeProducts = products.map(function(p) {
                    var prices = serverCalculatePrices(p.priceUSD, p.url, dollarRate);
                    return {
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        brand: p.brand || '',
                        image: p.image,
                        priceSN: prices.sn,
                        priceNF: prices.nf,
                        priceSNRaw: prices.snRaw,
                        priceNFRaw: prices.nfRaw
                    };
                });
                
                return res.status(200).json(safeProducts);
            }
            
            // Full data endpoint - requires authentication
            var secret = getSecret();
            if (!secret) {
                return res.status(500).json({ error: 'Erro interno de configuração' });
            }
            var authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Autenticação necessária' });
            }
            var token = authHeader.substring(7);
            if (!verifyToken(token, secret)) {
                return res.status(401).json({ error: 'Token inválido ou expirado' });
            }
            
            var products = await sql`
                SELECT id, url, name, category, brand, "priceUSD", image, "createdAt", "updatedAt"
                FROM "Product"
                ORDER BY "createdAt" DESC;
            `;
            return res.status(200).json(products);
        }

        if (req.method === 'POST') {
            var body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            var url = body.url;
            var name = body.name;
            var category = body.category;
            var brand = body.brand;
            var priceUSD = body.priceUSD;
            var image = body.image;
            
            if (!name || priceUSD === undefined || !image) {
                return res.status(400).json({ error: 'Campos obrigatórios (nome, preco, imagem) ausentes.' });
            }

            // Input validation
            if (String(name).length > MAX_NAME_LENGTH) {
                return res.status(400).json({ error: 'Nome do produto muito longo.' });
            }
            if (url && String(url).length > MAX_URL_LENGTH) {
                return res.status(400).json({ error: 'URL muito longa.' });
            }
            if (brand && String(brand).length > MAX_BRAND_LENGTH) {
                return res.status(400).json({ error: 'Marca muito longa.' });
            }
            if (String(image).length > MAX_IMAGE_LENGTH) {
                return res.status(400).json({ error: 'Imagem muito grande (máx ~2MB).' });
            }
            if (isNaN(parseFloat(priceUSD)) || parseFloat(priceUSD) <= 0) {
                return res.status(400).json({ error: 'Preço deve ser um número positivo.' });
            }
            if (category && VALID_CATEGORIES.indexOf(String(category)) === -1) {
                return res.status(400).json({ error: 'Categoria inválida.' });
            }

            var id = crypto.randomUUID();
            var result = await sql`
                INSERT INTO "Product" (id, url, name, category, brand, "priceUSD", image, "createdAt", "updatedAt")
                VALUES (${id}, ${url || ''}, ${String(name)}, ${String(category || 'outro')}, ${brand ? String(brand) : ''}, ${parseFloat(priceUSD)}, ${String(image)}, NOW(), NOW())
                RETURNING id, url, name, category, brand, "priceUSD", image, "createdAt", "updatedAt";
            `;
            return res.status(201).json(result[0]);
        }

        if (req.method === 'PUT') {
            var body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            var productId = body.id || req.query.id;

            if (!productId) {
                return res.status(400).json({ error: 'ID do produto é obrigatório para atualização.' });
            }

            // Input validation
            if (body.name && String(body.name).length > MAX_NAME_LENGTH) {
                return res.status(400).json({ error: 'Nome do produto muito longo.' });
            }
            if (body.url && String(body.url).length > MAX_URL_LENGTH) {
                return res.status(400).json({ error: 'URL muito longa.' });
            }
            if (body.brand && String(body.brand).length > MAX_BRAND_LENGTH) {
                return res.status(400).json({ error: 'Marca muito longa.' });
            }
            if (body.image && String(body.image).length > MAX_IMAGE_LENGTH) {
                return res.status(400).json({ error: 'Imagem muito grande (máx ~2MB).' });
            }
            if (body.priceUSD !== undefined && (isNaN(parseFloat(body.priceUSD)) || parseFloat(body.priceUSD) <= 0)) {
                return res.status(400).json({ error: 'Preço deve ser um número positivo.' });
            }
            if (body.category && VALID_CATEGORIES.indexOf(String(body.category)) === -1) {
                return res.status(400).json({ error: 'Categoria inválida.' });
            }

            var name = body.name !== undefined ? String(body.name) : null;
            var url = body.url !== undefined ? String(body.url) : null;
            var category = body.category !== undefined ? String(body.category) : null;
            var brand = body.brand !== undefined ? String(body.brand) : null;
            var priceUSD = body.priceUSD !== undefined ? parseFloat(body.priceUSD) : null;
            var image = body.image !== undefined ? String(body.image) : null;

            var result = await sql`
                UPDATE "Product"
                SET 
                    url = COALESCE(${url}, url),
                    name = COALESCE(${name}, name),
                    category = COALESCE(${category}, category),
                    brand = COALESCE(${brand}, brand),
                    "priceUSD" = COALESCE(${priceUSD}, "priceUSD"),
                    image = COALESCE(${image}, image),
                    "updatedAt" = NOW()
                WHERE id = ${String(productId)}
                RETURNING id, url, name, category, brand, "priceUSD", image, "createdAt", "updatedAt";
            `;

            if (result.length === 0) {
                return res.status(404).json({ error: 'Produto não encontrado.' });
            }

            return res.status(200).json(result[0]);
        }

        if (req.method === 'DELETE') {
            var body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            var productId = req.query.id || body.id;
            
            if (!productId) {
                return res.status(400).json({ error: 'ID do produto é obrigatório para remoção.' });
            }

            await sql`
                DELETE FROM "Product"
                WHERE id = ${String(productId)};
            `;

            return res.status(200).json({ success: true, message: 'Produto removido com sucesso.' });
        }

        return res.status(405).json({ error: 'Método não permitido' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
