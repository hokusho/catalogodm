// =============================================
// Admin-only Calculation Utilities
// This file is NOT loaded on the public catalog page (index.html)
// =============================================

// Fetch Dollar Rate from API
async function getDollarRate() {
    try {
        var response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        var data = await response.json();
        return parseFloat(data.USDBRL.ask);
    } catch (error) {
        return 5.50;
    }
}

// Price Calculation Helper (used for real-time preview in admin/edit forms)
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

    var currentDollar = dollarRate || 5.00;
    var snPrice, nfPrice, ruleName;

    if (url && url.includes('comprasparaguai.com.br')) {
        ruleName = 'Compras Paraguai';
        var specialDollar = currentDollar + 0.20;
        var baseValueBRL = priceUSD * specialDollar;
        snPrice = baseValueBRL * 1.36;
        nfPrice = snPrice * 1.13;
    } else {
        ruleName = 'Padrão (Amazon / B&H / Nissei)';
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
        snRaw: snPrice,
        nfRaw: nfPrice,
        rule: ruleName
    };
}
