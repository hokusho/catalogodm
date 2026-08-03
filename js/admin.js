document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetchDataBtn');
    const productForm = document.getElementById('productForm');
    const loader = document.getElementById('fetchLoader');

    if (fetchBtn) {
        fetchBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = document.getElementById('productUrl').value;
            if (!url) {
                showToast("Por favor, insira o link do produto.", true);
                return;
            }

            loader.style.display = 'block';
            fetchBtn.disabled = true;

            let title = '';
            let price = '';
            let image = '';
            let doc = null;

            if (url.includes('nissei.com')) {
                loader.style.display = 'none';
                fetchBtn.disabled = false;
                showToast("A Nissei bloqueia buscas automáticas (Cloudflare). Por favor, preencha o Nome e Valor Base manualmente. O cálculo de venda será automático!", false);
                return;
            }

            try {
                // Tentativa 1: corsproxy.io (Proxy mais robusto)
                const corsUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const corsResponse = await fetch(corsUrl);
                if (corsResponse.ok) {
                    const html = await corsResponse.text();
                    const parser = new DOMParser();
                    doc = parser.parseFromString(html, 'text/html');
                }
            } catch (e) {
                console.log("Corsproxy falhou", e);
            }

            if (!doc) {
                try {
                    // Tentativa 2: AllOrigins
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                    const response = await fetch(proxyUrl);
                    
                    if (response.ok) {
                        const data = await response.json();
                        const html = data.contents;
                        const parser = new DOMParser();
                        doc = parser.parseFromString(html, 'text/html');
                    }
                } catch (err) {
                    console.log("AllOrigins falhou.", err);
                }
            }

            if (doc) {
                // Extração Genérica (Open Graph)
                const ogTitle = doc.querySelector('meta[property="og:title"]');
                if (ogTitle) title = ogTitle.getAttribute('content');
                
                const ogImage = doc.querySelector('meta[property="og:image"]');
                if (ogImage) image = ogImage.getAttribute('content');

                if (url.includes('amazon.')) {
                    if (!title) {
                        const titleEl = doc.getElementById('productTitle');
                        if (titleEl) title = titleEl.textContent.trim();
                    }
                    const priceEl = doc.querySelector('.a-price .a-offscreen') || doc.querySelector('#priceblock_ourprice');
                    if (priceEl) price = priceEl.textContent.replace(/[^0-9.]/g, '');
                    
                    if (!image) {
                        const imgEl = doc.getElementById('landingImage');
                        if (imgEl) image = imgEl.src || imgEl.getAttribute('data-old-hires') || imgEl.getAttribute('data-a-dynamic-image');
                        if (image && image.startsWith('{')) {
                            const imgObj = JSON.parse(image);
                            image = Object.keys(imgObj)[0];
                        }
                    }
                } else if (url.includes('bhphotovideo.com')) {
                    if (!title) {
                        const titleEl = doc.querySelector('[data-selenium="productTitle"]') || doc.querySelector('h1[data-selenium="productTitle"]');
                        if (titleEl) title = titleEl.textContent.trim();
                    }
                    const priceEl = doc.querySelector('[data-selenium="pricingPrice"]') || doc.querySelector('.price_1JN83N22V'); 
                    if (priceEl) price = priceEl.textContent.replace(/[^0-9.]/g, '');
                    
                    if (!image) {
                        const imgEl = doc.querySelector('[data-selenium="inlineMediaMainImage"]') || doc.querySelector('img[data-selenium="inlineMediaMainImage"]');
                        if (imgEl) image = imgEl.src;
                    }
                } else if (url.includes('comprasparaguai.com.br')) {
                    // O Compras Paraguai tem bons meta tags para Título e Imagem via Open Graph
                    // Se o preço não for carregado automaticamente, o usuário pode preencher
                    const metaPrice = doc.querySelector('meta[property="product:price:amount"]');
                    if (metaPrice) price = metaPrice.getAttribute('content');
                }
            }

            // Fallback (Método 2): Microlink API
            if (!title || !image || !price) {
                try {
                    // Usando microlink com regras de data scraping para tentar pegar o preço
                    let fallbackUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
                    
                    // Adiciona regra de preço e imagem se for B&H ou Nissei
                    if (url.includes('bhphotovideo.com')) {
                        fallbackUrl += `&data.price.selector=${encodeURIComponent('[data-selenium="pricingPrice"]')}&data.price.type=text`;
                        fallbackUrl += `&data.priceAlt.selector=${encodeURIComponent('.price_1JN83N22V')}&data.priceAlt.type=text`;
                        fallbackUrl += `&data.img.selector=${encodeURIComponent('img[data-selenium="inlineMediaMainImage"]')}&data.img.attr=src`;
                    } else if (url.includes('nissei.com')) {
                        fallbackUrl += `&data.price.selector=${encodeURIComponent('meta[property="product:price:amount"]')}&data.price.attr=content`;
                    }
                    
                    const fallbackResponse = await fetch(fallbackUrl);
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        if (fallbackData.status === 'success') {
                            if (!title && fallbackData.data.title) title = fallbackData.data.title;
                            if (!image && fallbackData.data.image && fallbackData.data.image.url) image = fallbackData.data.image.url;
                            if (!image && fallbackData.data.img) image = fallbackData.data.img;
                            // Removido o fallback para a logo da empresa para não poluir o cadastro
                            
                            // Extrai o preço das regras customizadas
                            if (!price && fallbackData.data.price) {
                                price = fallbackData.data.price.replace(/[^0-9.]/g, '');
                            } else if (!price && fallbackData.data.priceAlt) {
                                price = fallbackData.data.priceAlt.replace(/[^0-9.]/g, '');
                            }
                        }
                    }
                } catch (fallbackErr) {
                    console.log("Fallback API falhou.", fallbackErr);
                }
            }

            // Preenche os campos se encontrou
            if (title) document.getElementById('productName').value = title;
            if (price) document.getElementById('productPriceUSD').value = parseFloat(price).toFixed(2);
            if (image) document.getElementById('productImage').value = image;
            if (title || image || price) {
                if (title) document.getElementById('productName').value = title;
                if (image) document.getElementById('productImage').value = image;
                if (price) document.getElementById('productPriceUSD').value = parseFloat(price).toFixed(2);
                
                if (title && image && price) {
                    showToast("Dados encontrados com sucesso!", false);
                } else {
                    showToast("Alguns dados não foram encontrados. Por favor, preencha o restante manualmente.", false);
                }
            } else {
                showToast("Erro ao processar dados da página. Preencha manualmente.", true);
            }

            loader.style.display = 'none';
            fetchBtn.disabled = false;
        });
    }

    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const url = document.getElementById('productUrl').value;
            const name = document.getElementById('productName').value;
            const category = document.getElementById('productCategory').value;
            const priceUSD = parseFloat(document.getElementById('productPriceUSD').value);
            const image = document.getElementById('productImage').value;

            if (!name || !priceUSD || !image) {
                showToast("Preencha todos os campos obrigatórios.", true);
                return;
            }

            const product = {
                url,
                name,
                category,
                priceUSD,
                image
            };

            saveProduct(product);
            showToast("Produto cadastrado com sucesso!");
            productForm.reset();
            document.getElementById('productUrl').value = '';
        });
    }
});
