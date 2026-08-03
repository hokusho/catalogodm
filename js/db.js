// Strict API Database Utility - Direct connection to Vercel/Prisma/Neon API
const API_URL = '/api/products';

async function getProducts() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error || `HTTP ${response.status} ${response.statusText}`;
            showToast(`Erro Banco Neon (GET): ${msg}`, true);
            console.error("Erro ao buscar produtos do Neon:", msg);
            return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        showToast(`Erro Conexão API: ${err.message}`, true);
        console.error("Erro na conexão com API:", err);
        return [];
    }
}

async function saveProduct(product) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error || `HTTP ${response.status} ${response.statusText}`;
            showToast(`ERRO BANCO NEON: ${msg}`, true);
            throw new Error(`Falha ao salvar no Neon: ${msg}`);
        }
        
        const saved = await response.json();
        return saved;
    } catch (err) {
        showToast(`ERRO CONEXÃO API: ${err.message}`, true);
        throw err;
    }
}

async function deleteProduct(id) {
    try {
        const response = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error || `HTTP ${response.status} ${response.statusText}`;
            showToast(`ERRO BANCO NEON: ${msg}`, true);
            throw new Error(`Falha ao remover no Neon: ${msg}`);
        }
        
        return true;
    } catch (err) {
        showToast(`ERRO CONEXÃO API: ${err.message}`, true);
        throw err;
    }
}

async function updateProduct(id, updatedData) {
    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...updatedData })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error || `HTTP ${response.status} ${response.statusText}`;
            showToast(`ERRO BANCO NEON: ${msg}`, true);
            throw new Error(`Falha ao atualizar no Neon: ${msg}`);
        }
        
        const updated = await response.json();
        return updated;
    } catch (err) {
        showToast(`ERRO CONEXÃO API: ${err.message}`, true);
        throw err;
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

// Global Image Downloader & 300px WebP Optimizer
async function downloadAndOptimizeImage(imageUrl) {
    if (!imageUrl) return '';

    let blob = null;

    if (imageUrl.startsWith('data:')) {
        try {
            const res = await fetch(imageUrl);
            blob = await res.blob();
        } catch (e) {
            console.log("Erro ao converter data URL para blob:", e);
        }
    } else {
        // Tenta baixar via CORS proxy
        try {
            const corsUrl = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
            const res = await fetch(corsUrl);
            if (res.ok) {
                blob = await res.blob();
            }
        } catch (e) {
            console.log("Corsproxy falhou para imagem, tentando fetch direto...", e);
        }

        if (!blob) {
            try {
                const res = await fetch(imageUrl);
                if (res.ok) blob = await res.blob();
            } catch (e) {
                console.log("Fetch direto da imagem falhou:", e);
            }
        }
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const processCanvas = () => {
            try {
                const targetHeight = 300;
                const aspect = (img.width && img.height) ? (img.width / img.height) : 1;
                const targetWidth = Math.round(targetHeight * aspect);

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                let webpUrl = canvas.toDataURL('image/webp', 0.82);
                if (!webpUrl.startsWith('data:image/webp')) {
                    webpUrl = canvas.toDataURL('image/jpeg', 0.82);
                }
                resolve(webpUrl);
            } catch (err) {
                console.warn("Erro ao processar canvas da imagem, usando URL original:", err);
                resolve(imageUrl);
            }
        };

        if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                processCanvas();
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(imageUrl);
            };
            img.src = objectUrl;
        } else {
            img.onload = processCanvas;
            img.onerror = () => resolve(imageUrl);
            img.src = imageUrl;
        }
    });
}


