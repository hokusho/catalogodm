document.addEventListener('DOMContentLoaded', async () => {
    const fetchBtn = document.getElementById('fetchDataBtn');
    const productForm = document.getElementById('productForm');
    const loader = document.getElementById('fetchLoader');
    const priceInput = document.getElementById('productPriceUSD');
    const urlInput = document.getElementById('productUrl');

    let currentDollarAPI = 5.00;

    // Função para atualizar a prévia de preços na tela de admin
    function updatePricePreview() {
        const priceSNEl = document.getElementById('previewPriceSN');
        const priceNFEl = document.getElementById('previewPriceNF');
        const dollarRateEl = document.getElementById('previewDollarRate');
        const ruleEl = document.getElementById('previewRule');

        if (!priceInput || !priceSNEl || !priceNFEl) return;

        if (dollarRateEl && currentDollarAPI) {
            dollarRateEl.textContent = `Dólar API: R$ ${currentDollarAPI.toFixed(2).replace('.', ',')}`;
        }

        const priceUSD = parseFloat(priceInput.value);
        let urlForCalc = urlInput ? urlInput.value : '';

        const ruleRadios = document.getElementsByName('calcRule');
        if (ruleRadios && ruleRadios.length > 0) {
            const selectedRule = Array.from(ruleRadios).find(r => r.checked)?.value;
            if (selectedRule === 'paraguai') {
                urlForCalc = 'https://comprasparaguai.com.br';
            } else {
                urlForCalc = 'https://bhphotovideo.com';
            }
        }

        const prices = calculatePrices(priceUSD, urlForCalc, currentDollarAPI);

        priceSNEl.textContent = prices.sn;
        priceNFEl.textContent = prices.nf;
        if (ruleEl) ruleEl.textContent = prices.rule;
    }

    // Busca o dólar atual e atualiza a prévia inicial
    currentDollarAPI = await getDollarRate();
    updatePricePreview();

    // Event listeners para atualização em tempo real no cadastro
    if (priceInput) {
        priceInput.addEventListener('input', updatePricePreview);
        priceInput.addEventListener('change', updatePricePreview);
    }
    if (urlInput) {
        urlInput.addEventListener('input', updatePricePreview);
        urlInput.addEventListener('change', updatePricePreview);
    }
    const ruleRadios = document.getElementsByName('calcRule');
    if (ruleRadios && ruleRadios.length > 0) {
        ruleRadios.forEach(radio => {
            radio.addEventListener('change', updatePricePreview);
        });
    }

    if (urlInput && ruleRadios && ruleRadios.length > 0) {
        urlInput.addEventListener('input', () => {
            const val = urlInput.value.toLowerCase();
            if (val.includes('comprasparaguai.com.br')) {
                ruleRadios[1].checked = true;
            } else if (val) {
                ruleRadios[0].checked = true;
            }
            updatePricePreview();
        });
    }

    // Função de busca paralela ultra-rápida (Promise.any)
    async function fetchHtmlFast(targetUrl) {
        const fetchWithTimeout = async (reqUrl, options = {}, timeoutMs = 3500) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(reqUrl, { ...options, signal: controller.signal });
                clearTimeout(id);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res;
            } catch (e) {
                clearTimeout(id);
                throw e;
            }
        };

        const fetchers = [
            async () => {
                const res = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
                const html = await res.text();
                return new DOMParser().parseFromString(html, 'text/html');
            },
            async () => {
                const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
                const data = await res.json();
                return new DOMParser().parseFromString(data.contents, 'text/html');
            },
            async () => {
                const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
                const html = await res.text();
                return new DOMParser().parseFromString(html, 'text/html');
            },
            async () => {
                const res = await fetchWithTimeout(`https://cors.eu.org/${targetUrl}`);
                const html = await res.text();
                return new DOMParser().parseFromString(html, 'text/html');
            }
        ];

        try {
            return await Promise.any(fetchers.map(fn => fn()));
        } catch (e) {
            console.warn("Corrida de proxies estourou tempo limite:", e);
            return null;
        }
    }

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

            if (url.includes('nissei.com')) {
                loader.style.display = 'none';
                fetchBtn.disabled = false;
                showToast("A Nissei bloqueia buscas automáticas (Cloudflare). Por favor, preencha o Nome e Valor Base manualmente. O cálculo de venda será automático!", false);
                return;
            }

            showToast("Buscando dados em alta velocidade...");
            try {
                let doc = await fetchHtmlFast(url);

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
                    if (priceEl) {
                        price = priceEl.textContent.replace(/[^0-9.]/g, '');
                    } else {
                        const whole = doc.querySelector('.a-price-whole');
                        const fraction = doc.querySelector('.a-price-fraction');
                        if (whole) {
                            price = whole.textContent.replace(/[^0-9]/g, '') + '.' + (fraction ? fraction.textContent.replace(/[^0-9]/g, '') : '00');
                        }
                    }
                    
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
                    let rawPriceText = '';
                    const priceSpan = doc.querySelector('.header-product-info--price span') ||
                                      doc.querySelector('.header-product-info--price') ||
                                      doc.querySelector('meta[property="product:price:amount"]');
                    
                    if (priceSpan) {
                        rawPriceText = priceSpan.tagName === 'META' ? priceSpan.getAttribute('content') : priceSpan.textContent;
                    } else {
                        const spans = Array.from(doc.querySelectorAll('span'));
                        const usdSpan = spans.find(s => s.textContent.includes('US$'));
                        if (usdSpan) rawPriceText = usdSpan.textContent;
                    }

                    if (rawPriceText) {
                        let clean = rawPriceText.replace(/US\$/i, '').trim();
                        if (clean.includes(',')) {
                            clean = clean.replace(/\./g, '').replace(',', '.');
                        }
                        const parsed = parseFloat(clean.replace(/[^0-9.]/g, ''));
                        if (!isNaN(parsed) && parsed > 0) {
                            price = parsed.toString();
                        }
                    }
                }
            }


            // Fallback (Método 2): Microlink API
            if (!title || !image || !price) {
                try {
                    let fallbackUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&prerender=true`;
                    
                    if (url.includes('bhphotovideo.com')) {
                        fallbackUrl += `&data.price.selector=${encodeURIComponent('[data-selenium="pricingPrice"]')}&data.price.type=text`;
                        fallbackUrl += `&data.priceAlt.selector=${encodeURIComponent('.price_1JN83N22V')}&data.priceAlt.type=text`;
                        fallbackUrl += `&data.img.selector=${encodeURIComponent('img[data-selenium="inlineMediaMainImage"]')}&data.img.attr=src`;
                    } else if (url.includes('comprasparaguai.com.br')) {
                        fallbackUrl += `&data.price.selector=${encodeURIComponent('.header-product-info--price span')}&data.price.type=text`;
                    }
                    
                    const fallbackResponse = await fetch(fallbackUrl);
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        if (fallbackData.status === 'success') {
                            if (!title && fallbackData.data.title) title = fallbackData.data.title;
                            if (!image && fallbackData.data.image && fallbackData.data.image.url) image = fallbackData.data.image.url;
                            if (!image && fallbackData.data.img) image = fallbackData.data.img;
                            
                            if (!price && fallbackData.data.price) {
                                let rawP = fallbackData.data.price;
                                let clean = rawP.replace(/US\$/i, '').trim();
                                if (clean.includes(',')) {
                                    clean = clean.replace(/\./g, '').replace(',', '.');
                                }
                                const parsed = parseFloat(clean.replace(/[^0-9.]/g, ''));
                                if (!isNaN(parsed) && parsed > 0) price = parsed.toString();
                            }
                        }
                    }
                } catch (fallbackErr) {
                    console.log("Fallback API falhou.", fallbackErr);
                }
            }

                // Fallback (Método 3): JSONLink API para Título e Imagem
                if (!title || !image) {
                    try {
                        const jsonlinkUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
                        const jlRes = await fetch(jsonlinkUrl);
                        if (jlRes.ok) {
                            const jlData = await jlRes.json();
                            if (!title && jlData.title) title = jlData.title;
                            if (!image && jlData.image) image = jlData.image;
                        }
                    } catch (jlErr) {
                        console.log("JSONLink API falhou.", jlErr);
                    }
                }


            // Limpa sufixos de lojas do título (ex: "na loja Nissei no Paraguai", "| Amazon", etc.)
            function cleanProductTitle(rawTitle) {
                if (!rawTitle) return '';
                let clean = rawTitle.trim();
                clean = clean.replace(/\s+na\s+loja\s+.*$/i, '');
                clean = clean.replace(/\s+no\s+Paraguai.*$/i, '');
                clean = clean.replace(/\s*[-|:]\s*(Compras Paraguai|Amazon|B&H Photo Video|B&H).*$/i, '');
                return clean.trim();
            }

            if (title) title = cleanProductTitle(title);

            // Preenche os campos se encontrou
            if (image) {
                const optimizedImage = await downloadAndOptimizeImage(image);
                document.getElementById('productImage').value = optimizedImage;
                const previewImg = document.getElementById('imagePreview');
                const previewContainer = document.getElementById('imagePreviewContainer');
                if (previewImg) previewImg.src = optimizedImage;
                if (previewContainer) previewContainer.style.display = 'block';
            }

            if (title || image || price) {
                if (title) document.getElementById('productName').value = title;
                if (price) {
                    document.getElementById('productPriceUSD').value = parseFloat(price).toFixed(2);
                    document.getElementById('productPriceUSD').dispatchEvent(new Event('input'));
                    showToast("Dados preenchidos com sucesso!", false);
                } else {
                    showToast("Produto encontrado! Como o preço estava bloqueado pelo anti-robô, preencha o valor base manualmente.", false);
                }
            } else {
                showToast("Erro ao processar dados da página. Preencha manualmente.", true);
            }
        } catch (error) {
            showToast("Erro ao processar dados da página. Preencha manualmente.", true);
        }

            updatePricePreview();

            loader.style.display = 'none';
            fetchBtn.disabled = false;
        });
    }

    const imageInput = document.getElementById('productImage');
    const imageFileInput = document.getElementById('productImageFile');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImg = document.getElementById('imagePreview');

    async function processAndPreviewImage(source) {
        if (!source) {
            if (previewContainer) previewContainer.style.display = 'none';
            return '';
        }
        showToast("Otimizando imagem para WebP 300px...");
        const optimizedWebP = await downloadAndOptimizeImage(source);
        if (imageInput) imageInput.value = optimizedWebP;
        if (previewImg) previewImg.src = optimizedWebP;
        if (previewContainer) previewContainer.style.display = 'block';
        return optimizedWebP;
    }

    if (imageFileInput) {
        imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    await processAndPreviewImage(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const val = e.target.value;
            if (val && !val.startsWith('data:image/webp')) {
                await processAndPreviewImage(val);
            }
        });
    }


    const subCategories = {
        camera: ['CANON', 'SONY', 'NIKON'],
        lente: ['CANON', 'SONY', 'NIKON', 'SIGMA', 'TAMROM', 'OUTRAS'],
        cartao: ['SANDISK', 'LEXAR'],
        flash: ['GODOX'],
        microfone: ['SEM FIO']
    };

    const categorySelect = document.getElementById('productCategory');
    const brandGroup = document.getElementById('brandGroup');
    const brandSelect = document.getElementById('productBrand');
    const brandGroup2 = document.getElementById('brandGroup2');
    const brandSelect2 = document.getElementById('productBrand2');

    if (categorySelect && brandSelect) {
        const updateBrands = () => {
            const cat = categorySelect.value;
            const brands = subCategories[cat];
            
            brandSelect.innerHTML = '<option value="">(Nenhuma / Não se aplica)</option>';
            if (brandGroup2) brandGroup2.style.display = 'none';
            if (brandSelect2) brandSelect2.value = '';
            
            if (brands && brands.length > 0) {
                brands.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b;
                    opt.textContent = b;
                    brandSelect.appendChild(opt);
                });
                brandGroup.style.display = 'block';
            } else {
                brandGroup.style.display = 'none';
            }
        };

        categorySelect.addEventListener('change', updateBrands);
        updateBrands(); // Run once on load
        
        brandSelect.addEventListener('change', () => {
            if (brandGroup2 && brandSelect2 && categorySelect.value === 'lente') {
                const val = brandSelect.value;
                if (['SIGMA', 'TAMROM', 'OUTRAS'].includes(val)) {
                    brandSelect2.innerHTML = '<option value="">(Nenhuma / Não se aplica)</option>';
                    ['CANON', 'SONY', 'NIKON'].forEach(b => {
                        const opt = document.createElement('option');
                        opt.value = b;
                        opt.textContent = b;
                        brandSelect2.appendChild(opt);
                    });
                    brandGroup2.style.display = 'block';
                } else {
                    brandGroup2.style.display = 'none';
                    brandSelect2.value = '';
                }
            } else if (brandGroup2 && brandSelect2) {
                brandGroup2.style.display = 'none';
                brandSelect2.value = '';
            }
        });
    }

    function resetAdminForm() {
        if (productForm) productForm.reset();
        const urlInput = document.getElementById('productUrl');
        const fileInput = document.getElementById('productImageFile');
        const previewContainer = document.getElementById('imagePreviewContainer');
        const previewImg = document.getElementById('imagePreview');
        const bGroup2 = document.getElementById('brandGroup2');
        const ruleRadios = document.getElementsByName('calcRule');

        if (urlInput) urlInput.value = '';
        if (fileInput) fileInput.value = '';
        if (previewImg) previewImg.src = '';
        if (previewContainer) previewContainer.style.display = 'none';
        if (bGroup2) bGroup2.style.display = 'none';
        if (ruleRadios && ruleRadios.length > 0) ruleRadios[0].checked = true;

        updatePricePreview();
    }

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const url = document.getElementById('productUrl').value;
            const name = document.getElementById('productName').value;
            const category = document.getElementById('productCategory').value;
            let brand = document.getElementById('productBrand').value;
            const brand2 = document.getElementById('productBrand2') ? document.getElementById('productBrand2').value : '';
            if (brand2) {
                brand = `${brand},${brand2}`;
            }
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
                brand,
                priceUSD,
                image
            };

            try {
                await saveProduct(product);
                showToast("Produto cadastrado com sucesso no Banco Neon!");
                resetAdminForm();
            } catch (saveError) {
                console.error("Erro ao salvar produto no Neon:", saveError);
            }

        });
    }

    // Bloqueia envio do formulário ou disparo ao pressionar ENTER nos inputs
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') {
            e.preventDefault();
            return false;
        }
    });

});


