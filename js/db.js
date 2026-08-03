// Database Utility with API / Prisma Serverless integration & LocalStorage Fallback
const DB_KEY = 'dmbh_products';
const API_URL = '/api/products';

async function getProducts() {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                localStorage.setItem(DB_KEY, JSON.stringify(data));
                return data;
            }
        }
    } catch (err) {
        console.warn("API /api/products indisponível, usando cache local:", err);
    }
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
}

async function saveProduct(product) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if (response.ok) {
            const saved = await response.json();
            const products = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
            products.push(saved);
            localStorage.setItem(DB_KEY, JSON.stringify(products));
            return saved;
        }
    } catch (err) {
        console.warn("Falha ao salvar via API, salvando localmente:", err);
    }

    const products = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    if (!product.id) {
        product.id = Date.now().toString();
    }
    products.push(product);
    localStorage.setItem(DB_KEY, JSON.stringify(products));
    return product;
}

async function deleteProduct(id) {
    try {
        const response = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            const products = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
            const updated = products.filter(p => String(p.id) !== String(id));
            localStorage.setItem(DB_KEY, JSON.stringify(updated));
            return true;
        }
    } catch (err) {
        console.warn("Falha ao remover via API, removendo localmente:", err);
    }

    const products = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const updated = products.filter(p => String(p.id) !== String(id));
    localStorage.setItem(DB_KEY, JSON.stringify(updated));
    return true;
}

async function updateProduct(id, updatedData) {
    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...updatedData })
        });
        if (response.ok) {
            const updated = await response.json();
            const products = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
            const index = products.findIndex(p => String(p.id) === String(id));
            if (index !== -1) {
                products[index] = { ...products[index], ...updatedData };
                localStorage.setItem(DB_KEY, JSON.stringify(products));
            }
            return updated;
        }
    } catch (err) {
        console.warn("Falha ao atualizar via API, atualizando localmente:", err);
    }

    const products = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
    const index = products.findIndex(p => String(p.id) === String(id));
    if (index !== -1) {
        products[index] = { ...products[index], ...updatedData };
        localStorage.setItem(DB_KEY, JSON.stringify(products));
    }
}


// Global Toast Notification
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Fetch Dollar Rate
async function getDollarRate() {
    try {
        const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        const data = await response.json();
        return parseFloat(data.USDBRL.ask);
    } catch (error) {
        console.error("Error fetching dollar rate:", error);
        return 5.50; // Fallback value if API fails
    }
}

// Global Price Calculation Helper
function calculatePrices(priceUSD, url, dollarRate) {
    if (!priceUSD || isNaN(priceUSD) || priceUSD <= 0) {
        return {
            sn: 'R$ 0,00',
            nf: 'R$ 0,00',
            snRaw: 0,
            nfRaw: 0,
            rule: 'Padrão'
        };
    }

    const currentDollar = dollarRate || 5.00;
    let snPrice, nfPrice, ruleName;

    if (url && url.includes('comprasparaguai.com.br')) {
        ruleName = 'Compras Paraguai';
        // Regra Compras Paraguai: Dólar API + 0.20
        const specialDollar = currentDollar + 0.20;
        const baseValueBRL = priceUSD * specialDollar;

        // SN: Preço de Custo + 36%
        snPrice = baseValueBRL * 1.36;

        // NF: 13% sobre o SN
        nfPrice = snPrice * 1.13;
    } else {
        ruleName = 'Padrão (Amazon / B&H / Nissei)';
        // Regra Padrão (Amazon / B&H / outros)
        const safeDollar = currentDollar + 0.10;
        const baseValueBRL = priceUSD * safeDollar * 1.113;
        snPrice = baseValueBRL * 1.30;
        nfPrice = snPrice * 1.13;
    }

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return {
        sn: formatCurrency(snPrice),
        nf: formatCurrency(nfPrice),
        snRaw: snPrice,
        nfRaw: nfPrice,
        rule: ruleName
    };
}

