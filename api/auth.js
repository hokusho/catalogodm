const crypto = require('crypto');

// Generate HMAC-SHA256 token with 24h expiration
function generateToken(secret) {
    const expiration = String(Date.now() + 24 * 60 * 60 * 1000);
    const signature = crypto.createHmac('sha256', secret).update(expiration).digest('hex');
    return expiration + '.' + signature;
}

// Verify token integrity and expiration
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

// Timing-safe string comparison (handles different lengths)
function safeCompare(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
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

module.exports = async function handler(req, res) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS
    var allowedOrigins = getAllowedOrigins();
    var origin = req.headers.origin;
    if (origin && allowedOrigins.indexOf(origin) !== -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    var adminUser = process.env.ADMIN_USER;
    var adminPassword = process.env.ADMIN_PASSWORD;
    var secret = getSecret();

    if (!adminUser || !adminPassword || !secret) {
        return res.status(500).json({ error: 'Erro interno de configuração' });
    }

    // POST = Login (returns token)
    if (req.method === 'POST') {
        var body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        var user = body.user;
        var password = body.password;

        if (!user || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }

        var userMatch = safeCompare(user, adminUser);
        var passMatch = safeCompare(password, adminPassword);

        if (!userMatch || !passMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        var token = generateToken(secret);
        return res.status(200).json({ token: token });
    }

    // GET = Validate token
    if (req.method === 'GET') {
        var authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        var tokenValue = authHeader.substring(7);
        if (verifyToken(tokenValue, secret)) {
            return res.status(200).json({ valid: true });
        }

        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    return res.status(405).json({ error: 'Método não permitido' });
};
