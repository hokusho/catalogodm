import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
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

    try {
        if (req.method === 'GET') {
            const products = await prisma.product.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return res.status(200).json(products);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { url, name, category, brand, priceUSD, image } = body;
            
            if (!name || priceUSD === undefined || !image) {
                return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
            }

            const newProduct = await prisma.product.create({
                data: {
                    url: url || '',
                    name: String(name),
                    category: String(category || 'outro'),
                    brand: brand ? String(brand) : '',
                    priceUSD: parseFloat(priceUSD),
                    image: String(image)
                }
            });
            return res.status(201).json(newProduct);
        }

        if (req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const productId = body.id || req.query.id;

            if (!productId) {
                return res.status(400).json({ error: 'ID do produto é obrigatório para atualização.' });
            }

            const updatedProduct = await prisma.product.update({
                where: { id: String(productId) },
                data: {
                    ...(body.url !== undefined && { url: String(body.url) }),
                    ...(body.name !== undefined && { name: String(body.name) }),
                    ...(body.category !== undefined && { category: String(body.category) }),
                    ...(body.brand !== undefined && { brand: String(body.brand) }),
                    ...(body.priceUSD !== undefined && { priceUSD: parseFloat(body.priceUSD) }),
                    ...(body.image !== undefined && { image: String(body.image) })
                }
            });
            return res.status(200).json(updatedProduct);
        }

        if (req.method === 'DELETE') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const productId = req.query.id || body.id;
            
            if (!productId) {
                return res.status(400).json({ error: 'ID do produto é obrigatório para remoção.' });
            }

            await prisma.product.delete({
                where: { id: String(productId) }
            });
            return res.status(200).json({ success: true, message: 'Produto removido com sucesso.' });
        }

        return res.status(405).json({ error: 'Método não permitido' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message || 'Erro interno no servidor' });
    }
}
