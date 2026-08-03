// Database Utility for LocalStorage
const DB_KEY = 'dmbh_products';

function getProducts() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
}

function saveProduct(product) {
    const products = getProducts();
    if (!product.id) {
        product.id = Date.now().toString();
    }
    products.push(product);
    localStorage.setItem(DB_KEY, JSON.stringify(products));
}

function deleteProduct(id) {
    const products = getProducts();
    const updated = products.filter(p => p.id !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(updated));
}

function updateProduct(id, updatedData) {
    const products = getProducts();
    const index = products.findIndex(p => p.id === id);
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

