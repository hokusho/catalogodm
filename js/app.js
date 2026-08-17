document.addEventListener('DOMContentLoaded', async () => {
    // Detect page type
    const isCatalog = document.body.dataset.page === 'catalog';
    const isProtectedPage = !isCatalog;
    if (isProtectedPage) {
        const isValid = await validateToken();
        if (!isValid) {
            setupLoginModal();
            return;
        }
        const loginModal = document.getElementById('loginModal');
        const protectedContent = document.getElementById('protectedContent');
        if (loginModal) loginModal.classList.remove('active');
        if (protectedContent) protectedContent.style.display = '';
    }

    const productsGrid = document.getElementById('products-grid');
    const dollarDisplay = document.getElementById('dollar-display');
    const filterBtns = document.querySelectorAll('.filter-btn');

    const subCategories = {
        camera: ['CANON', 'SONY', 'NIKON'],
        lente: ['CANON', 'SONY', 'NIKON', 'SIGMA', 'TAMROM', 'OUTRAS'],
        cartao: ['SANDISK', 'LEXAR'],
        flash: ['GODOX'],
        microfone: ['SEM FIO']
    };

    let currentDollarAPI = 5.00;
    let currentBrand = null;

    // Constante centralizada do texto de aviso (Modal e Banner fixo)
    const TERMS_TEXT = `
Esta página trata-se de um <strong style="color: var(--primary-color);">CATÁLOGO DE PREÇOS</strong><br>
e não de uma loja virtual.<br>

Os valores são carregados de forma automática através dos servidores dos nossos fornecedores.<br> 
<strong style="color: var(--primary-color);">Portanto, OS PREÇOS PODEM SER DIFERENTES DOS MOSTRADOS NA PÁGINA</strong><br><br>

Alguns produtos podem estar disponíveis apenas sob encomenda<br>
os prazos de entrega podem variar de acordo com o produto.<br><br>

<strong style="color: var(--primary-color);">EM CASO DE DÚVIDAS, FALE COM NOSSA EQUIPE.</strong>`;

    // Initialize
    async function init() {
        if (typeof getDollarRate === 'function') {
            currentDollarAPI = await getDollarRate();
        }
        if (dollarDisplay && !isCatalog) {
            dollarDisplay.textContent = `Cotação Dólar (API): R$ ${currentDollarAPI.toFixed(2).replace('.', ',')}`;
        }

        // Injetar o texto de termos no modal e na página principal
        const modalTerms = document.getElementById('modal-terms-text');
        const pageTerms = document.getElementById('page-terms-text');
        if (modalTerms) modalTerms.innerHTML = TERMS_TEXT;
        if (pageTerms) pageTerms.innerHTML = TERMS_TEXT;

        renderBrandFilters('all');
        renderProducts('all');
    }

    function renderBrandFilters(category) {
        const container = document.getElementById('brand-filters');
        if (!container) return;

        const brands = subCategories[category];
        if (brands && brands.length > 0) {
            container.innerHTML = '';
            brands.forEach(brand => {
                const btn = document.createElement('button');
                btn.className = `sub-filter-btn ${brand === currentBrand ? 'active' : ''}`;
                btn.textContent = brand;
                btn.dataset.brand = brand;
                btn.addEventListener('click', (e) => {
                    if (currentBrand === brand) {
                        // Toggle off
                        e.target.classList.remove('active');
                        currentBrand = null;
                    } else {
                        // Toggle on
                        document.querySelectorAll('#brand-filters .sub-filter-btn').forEach(b => b.classList.remove('active'));
                        e.target.classList.add('active');
                        currentBrand = brand;
                    }
                    renderProducts(category);
                });
                container.appendChild(btn);
            });
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
        }
    }

    // Calculation logic uses calculatePrices from calc.js with currentDollarAPI
    function getAppPrices(priceUSD, url) {
        if (!currentDollarAPI) return { sn: 'Carregando...', nf: 'Carregando...', snRaw: 0, nfRaw: 0 };
        return calculatePrices(priceUSD, url, currentDollarAPI);
    }


    const installmentRates = [
        { label: '1x', rate: 1.0298 },
        { label: '2x', rate: 1.0441 },
        { label: '3x', rate: 1.0508 },
        { label: '4x', rate: 1.0575 },
        { label: '5x', rate: 1.0644 },
        { label: '6x', rate: 1.0711 },
        { label: '7x', rate: 1.0781 },
        { label: '8x', rate: 1.0848 },
        { label: '9x', rate: 1.0918 },
        { label: '10x', rate: 1.0987 },
        { label: '11x', rate: 1.1057 },
        { label: '12x', rate: 1.1126 }
    ];

    function generateInstallmentsHTML(basePrice) {
        if (!basePrice) return '';
        let optionsHTML = '<option value="" disabled selected>Parcelar na Maquineta</option>';
        installmentRates.forEach((inst, index) => {
            const numInstallments = index + 1;
            const total = basePrice * inst.rate;
            const installmentValue = total / numInstallments;

            optionsHTML += `<option value="${numInstallments}">${inst.label} de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentValue)}</option>`;
        });

        return `
            <select class="installment-dropdown" style="margin-top: -0.5rem; width: 100%; padding: 6px; font-size: 0.8rem; background: var(--bg-color); color: var(--text-main); border: 1px solid var(--card-border); border-top: none; border-radius: 0 0 8px 8px; outline: none; cursor: pointer;">
                ${optionsHTML}
            </select>
        `;
    }

    async function renderProducts(categoryFilter) {
        if (!productsGrid) return;

        const products = isCatalog ? await getCatalogProducts() : await getProducts();
        productsGrid.innerHTML = '';


        let filteredProducts = products;

        if (categoryFilter && categoryFilter !== 'all') {
            filteredProducts = products.filter(p => p.category === categoryFilter);
        }

        if (currentBrand) {
            filteredProducts = filteredProducts.filter(p => {
                const name = p.name.toUpperCase();
                const brandVal = (p.brand || '').toUpperCase();
                
                if (currentBrand === 'OUTRAS') {
                    const knownBrands = subCategories[categoryFilter];
                    return !knownBrands.some(kb => kb !== 'OUTRAS' && (name.includes(kb) || brandVal.includes(kb)));
                }
                return name.includes(currentBrand) || brandVal.includes(currentBrand);
            });
        }

        // Sort by price ascending (cheapest first)
        filteredProducts.sort((a, b) => {
            const priceA = a.priceUSD && typeof calculatePrices === 'function' ? (getAppPrices(a.priceUSD, a.url).snRaw || 0) : (a.priceSNRaw || 0);
            const priceB = b.priceUSD && typeof calculatePrices === 'function' ? (getAppPrices(b.priceUSD, b.url).snRaw || 0) : (b.priceSNRaw || 0);
            return priceA - priceB;
        });

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Nenhum produto encontrado.</p>';
            return;
        }

        filteredProducts.forEach(product => {
            let prices;
            if (product.priceUSD && typeof calculatePrices === 'function') {
                prices = getAppPrices(product.priceUSD, product.url);
            } else if (isCatalog && product.priceSN) {
                prices = {
                    sn: product.priceSN,
                    nf: product.priceNF,
                    snRaw: product.priceSNRaw,
                    nfRaw: product.priceNFRaw
                };
            } else {
                prices = getAppPrices(product.priceUSD, product.url);
            }

            const isFixed = product.url && (product.url.startsWith('fixed:') || product.url.includes('precofixo') || product.url === 'fixed');
            const adminInfoHTML = !isCatalog ? `
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                    <span><strong>${isFixed ? 'Preço Fixo:' : 'Base:'}</strong> ${isFixed ? 'R$ ' + (product.priceUSD || 0).toFixed(2).replace('.', ',') : '$' + (product.priceUSD || 0).toFixed(2)}</span>
                    <span style="font-weight: 700; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: ${isFixed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 107, 0, 0.15)'}; color: ${isFixed ? '#22c55e' : 'var(--primary-color)'}; border: 1px solid ${isFixed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 107, 0, 0.3)'};">
                        ${isFixed ? 'FIXO (R$)' : (product.url && product.url.includes('comprasparaguai') ? 'MS' : 'US')}
                    </span>
                </div>
            ` : '';

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-img-container">
                    <img src="${sanitizeImageUrl(product.image)}" alt="${escapeHTML(product.name)}" class="product-img" onerror="this.src='https://via.placeholder.com/250?text=Sem+Foto'">
                </div>
                <div class="product-info">
                    <h3 class="product-name" title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</h3>
                    
                    ${adminInfoHTML}
                    
                    <div class="price-container">
                        <div class="price-row highlight" style="${isCatalog ? 'border-bottom-left-radius: 0; border-bottom-right-radius: 0;' : ''}">
                            <span class="price-label">Preço<span class="mobile-break"> Recibo de Compra</span></span>
                            <span class="price-value">${prices.sn}</span>
                        </div>
                        ${isCatalog ? generateInstallmentsHTML(prices.snRaw) : ''}
                        
                        <div class="price-row" style="margin-top: 8px; ${isCatalog ? 'border-bottom-left-radius: 0; border-bottom-right-radius: 0;' : ''}">
                            <span class="price-label">Preço NF</span>
                            <span class="price-value" style="font-size: 0.85rem; font-weight: normal;">${prices.nf}</span>
                        </div>
                        ${isCatalog ? generateInstallmentsHTML(prices.nfRaw) : ''}
                    </div>
                    
                    ${isCatalog ? `
                    <a href="https://wa.me/5581999939205?text=${encodeURIComponent(`Olá! Tenho interesse no produto:\n*${product.name}*\n\nVi no catálogo os seguintes valores:\n• Com Recibo: *${prices.sn}*\n• Com Nota Fiscal: *${prices.nf}*\n\nPoderia me confirmar a disponibilidade?`)}" 
                       target="_blank" 
                       style="margin-top: 1.2rem; color: #25D366; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.4rem; text-decoration: none; padding: 0.4rem; border-radius: 6px; border: 1px solid rgba(37, 211, 102, 0.2); background: rgba(37, 211, 102, 0.05); transition: background 0.3s; white-space: nowrap;">
                        <i class="fa-brands fa-whatsapp" style="font-size: 0.9rem;"></i> Consultar
                    </a>` : ''}
                    
                    ${!isCatalog ? `
                    <div class="flex-btn-group" style="margin-top: 1rem;">
                        <button class="btn btn-secondary edit-btn" data-id="${product.id}" style="font-size: 0.8rem; padding: 0.5rem;">Editar</button>
                        <button class="btn delete-btn" data-id="${product.id}" style="margin-top:0; font-size: 0.8rem; padding: 0.5rem;">Remover</button>
                    </div>` : ''}
                </div>
            `;
            productsGrid.appendChild(card);
        });

    function getCurrentCategory() {
        const activeBtn = document.querySelector('.filter-btn.active');
        return activeBtn ? activeBtn.dataset.category : 'all';
    }

    // Attach delete and edit events only if button exists
    if (!isCatalog) {
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Tem certeza que deseja remover este produto?')) {
                    await deleteProduct(e.target.getAttribute('data-id'));
                    await renderProducts(getCurrentCategory());
                    showToast("Produto removido.");
                }
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const products = await getProducts();
                const product = products.find(p => String(p.id) === String(id));
                if (product && typeof openEditModal === 'function') openEditModal(product);
            });
        });
    }
}




// Filter Logic
filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentBrand = null; // Reset brand when changing main category
        const category = e.target.dataset.category;
        renderBrandFilters(category);
        renderProducts(category);
    });
});


// Refresh Data Button Logic
const refreshBtn = document.getElementById('refresh-data-btn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
        const originalHTML = refreshBtn.innerHTML;
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Atualizando...';
        currentDollarAPI = await getDollarRate();
        if (dollarDisplay) {
            dollarDisplay.textContent = `Cotação Dólar (API): R$ ${currentDollarAPI.toFixed(2).replace('.', ',')}`;
        }
        renderProducts(getCurrentCategory());
        showToast("Dados atualizados com sucesso!");
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = originalHTML;
    });
}

// Terms Modal Logic
const termsModal = document.getElementById('termsModal');
const agreeTerms = document.getElementById('agreeTerms');
const enterSiteBtn = document.getElementById('enterSiteBtn');
const mainContent = document.getElementById('main-content');

if (termsModal && agreeTerms && enterSiteBtn) {
    // Always require terms acceptance on page load
    // Checkbox logic
    agreeTerms.addEventListener('change', (e) => {
        if (e.target.checked) {
            enterSiteBtn.removeAttribute('disabled');
        } else {
            enterSiteBtn.setAttribute('disabled', 'true');
        }
    });

    // Enter button logic
    enterSiteBtn.addEventListener('click', () => {
        termsModal.classList.remove('active');
        if (mainContent) mainContent.classList.remove('blurred');
    });

    // Reset checkbox on reload in some browsers
    agreeTerms.checked = false;
    enterSiteBtn.setAttribute('disabled', 'true');
}

init();

});
