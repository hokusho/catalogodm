const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        return res.status(500).json({ error: 'A variável DATABASE_URL não está configurada na Vercel.' });
    }

    const sql = neon(databaseUrl);

    try {
        // Cria a tabela Product automaticamente no Neon se ela ainda não existir
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

        if (req.method === 'GET') {
            const products = await sql`
                SELECT id, url, name, category, brand, "priceUSD", image, "createdAt", "updatedAt"
                FROM "Product"
                ORDER BY "createdAt" DESC;
            `;
            return res.status(200).json(products);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { url, name, category, brand, priceUSD, image } = body;
            
            if (!name || priceUSD === undefined || !image) {
                return res.status(400).json({ error: 'Campos obrigatórios (nome, preco, imagem) ausentes.' });
            }

            const id = require('crypto').randomUUID();
            const result = await sql`
                INSERT INTO "Product" (id, url, name, category, brand, "priceUSD", image, "createdAt", "updatedAt")
                VALUES (${id}, ${url || ''}, ${String(name)}, ${String(category || 'outro')}, ${brand ? String(brand) : ''}, ${parseFloat(priceUSD)}, ${String(image)}, NOW(), NOW())
                RETURNING id, url, name, category, brand, "priceUSD", image, "createdAt", "updatedAt";
            `;
            return res.status(201).json(result[0]);
        }

        if (req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const productId = body.id || req.query.id;

            if (!productId) {
                return res.status(400).json({ error: 'ID do produto é obrigatório para atualização.' });
            }

            const name = body.name !== undefined ? String(body.name) : null;
            const url = body.url !== undefined ? String(body.url) : null;
            const category = body.category !== undefined ? String(body.category) : null;
            const brand = body.brand !== undefined ? String(body.brand) : null;
            const priceUSD = body.priceUSD !== undefined ? parseFloat(body.priceUSD) : null;
            const image = body.image !== undefined ? String(body.image) : null;

            const result = await sql`
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
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const productId = req.query.id || body.id;
            
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
        console.error('Neon API Error:', error);
        return res.status(500).json({ error: error.message || 'Erro no banco de dados Neon' });
    }
};
