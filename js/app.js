document.addEventListener('DOMContentLoaded', async () => {
    const productsGrid = document.getElementById('products-grid');
    const dollarDisplay = document.getElementById('dollar-display');
    const filterBtns = document.querySelectorAll('.filter-btn');

    const subCategories = {
        camera: ['CANON', 'SONY', 'NIKON'],
        lente: ['CANON', 'SONY', 'NIKON', 'SIGMA', 'TAMROM', 'OUTRAS'],
        cartao: ['SANDISK', 'LEXAR'],
        flash: ['GODOX']
    };

    let currentDollarAPI = 5.00;
    let currentBrand = null;

    // Constante centralizada do texto de aviso (Modal e Banner fixo)
    const TERMS_TEXT = `
Esta página trata-se de um <strong style="color: var(--primary-color);">CATÁLOGO DE PREÇOS</strong><br>
E não de uma loja virtual.<br>

<strong style="color: var(--primary-color);">Os valores</strong> são carregados de forma automática através dos servidores dos nossos fornecedores,<br> 
<strong style="color: var(--primary-color);">Portanto podem ser diferentes dos mostrados e não corresponder corretamente ao valor.</strong><br><br>

Alguns produtos podem estar disponíveis apenas sob encomenda.<br>
Os prazos de entrega podem variar de acordo com o produto<br><br>

<strong style="color: var(--primary-color);">EM CASO DE DÚVIDAS, FALE COM NOSSA EQUIPE.</strong>`;

    // Initialize
    async function init() {
        currentDollarAPI = await getDollarRate();

        if (dollarDisplay) {
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

    // Calculation logic based on user request:
    // Helper to format currency
    function calculatePrices(priceUSD, url) {
        if (!currentDollarAPI) return { sn: 'Carregando...', nf: 'Carregando...' };

        let snPrice, nfPrice;

        if (url && url.includes('comprasparaguai.com.br')) {
            // Regra Compras Paraguai: Dólar API + 0.20
            const specialDollar = currentDollarAPI + 0.20;
            const baseValueBRL = priceUSD * specialDollar;

            // SN: Preço de Custo + 36%
            snPrice = baseValueBRL * 1.36;

            // NF: 13% sobre o SN (presumido) ou usando a fórmula normal
            nfPrice = snPrice * 1.13;
        } else {
            // Regra Padrão (Amazon / B&H)
            const safeDollar = currentDollarAPI + 0.10;
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
            nfRaw: nfPrice
        };
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

    function renderProducts(categoryFilter) {
        if (!productsGrid) return;

        const products = getProducts();
        productsGrid.innerHTML = '';

        let filteredProducts = products;

        if (categoryFilter && categoryFilter !== 'all') {
            filteredProducts = products.filter(p => p.category === categoryFilter);
        }

        if (currentBrand) {
            filteredProducts = filteredProducts.filter(p => {
                const name = p.name.toUpperCase();
                if (currentBrand === 'OUTRAS') {
                    const knownBrands = subCategories[categoryFilter];
                    return !knownBrands.some(kb => kb !== 'OUTRAS' && name.includes(kb));
                }
                return name.includes(currentBrand);
            });
        }

        // Sort by price ascending (cheapest first)
        filteredProducts.sort((a, b) => a.priceUSD - b.priceUSD);

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Nenhum produto encontrado.</p>';
            return;
        }

        const isCatalog = document.body.dataset.page === 'catalog';

        filteredProducts.forEach(product => {
            const prices = calculatePrices(product.priceUSD, product.url);

            let origin = 'Outros';
            if (product.url.includes('amazon.')) origin = 'Amazon';
            else if (product.url.includes('bhphotovideo.com')) origin = 'B&H Photo';
            else if (product.url.includes('comprasparaguai.com.br')) origin = 'Paraguai';

            const adminInfoHTML = !isCatalog ? `
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.8rem; display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                    <span><strong>Base:</strong> $${product.priceUSD.toFixed(2)}</span>
                    <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${origin}</span>
                </div>
            ` : '';

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-img-container">
                    <img src="${product.image}" alt="${product.name}" class="product-img" onerror="this.src='https://via.placeholder.com/250?text=Sem+Foto'">
                </div>
                <div class="product-info">
                    <h3 class="product-name" title="${product.name}">${product.name}</h3>
                    
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

        // Attach delete and edit events only if button exists
        if (!isCatalog) {
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (confirm('Tem certeza que deseja remover este produto?')) {
                        deleteProduct(e.target.getAttribute('data-id'));
                        renderProducts(document.querySelector('.filter-btn.active').dataset.category);
                        showToast("Produto removido.");
                    }
                });
            });

            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    const product = products.find(p => p.id === id);
                    if (product) openEditModal(product);
                });
            });
        }
    }

    // Modal Edit Logic
    function createModalHTML() {
        if (document.getElementById('editModal')) return;

        const modal = document.createElement('div');
        modal.id = 'editModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Editar Produto</h3>
                <form id="editForm">
                    <input type="hidden" id="editId">
                    <div class="form-group">
                        <label>Link do Produto (URL)</label>
                        <input type="url" id="editUrl" required>
                    </div>
                    <div class="form-group">
                        <label>Nome do Produto</label>
                        <input type="text" id="editName" required>
                    </div>
                    <div class="form-group">
                        <label>Categoria</label>
                        <select id="editCategory" required>
                            <option value="camera">Câmera</option>
                            <option value="lente">Lente</option>
                            <option value="cartao">Cartão de Memória</option>
                            <option value="flash">Flash</option>
                            <option value="outro">Outro</option>
                        </select>
                    </div>
                    <div class="form-group" id="editBrandGroup" style="display: none;">
                        <label>Marca</label>
                        <select id="editBrand">
                            <option value="">(Nenhuma / Não se aplica)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Preço Base (USD)</label>
                        <input type="number" step="0.01" id="editPrice" required>
                    </div>
                    <div class="form-group">
                        <label>URL da Foto</label>
                        <input type="url" id="editImage" required>
                    </div>
                    <div class="flex-btn-group">
                        <button type="button" class="btn btn-secondary" id="closeModalBtn">Cancelar</button>
                        <button type="submit" class="btn">Salvar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('closeModalBtn').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        document.getElementById('editForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('editId').value;
            const updatedData = {
                url: document.getElementById('editUrl').value,
                name: document.getElementById('editName').value,
                category: document.getElementById('editCategory').value,
                brand: document.getElementById('editBrand').value,
                priceUSD: parseFloat(document.getElementById('editPrice').value),
                image: document.getElementById('editImage').value
            };

            updateProduct(id, updatedData);
            modal.classList.remove('active');
            showToast("Produto atualizado com sucesso!");
            renderProducts(document.querySelector('.filter-btn.active').dataset.category);
        });
    }

    function openEditModal(product) {
        createModalHTML();

        const catSelect = document.getElementById('editCategory');
        const brandSelect = document.getElementById('editBrand');
        const brandGroup = document.getElementById('editBrandGroup');

        const updateEditBrands = () => {
            const cat = catSelect.value;
            const brands = subCategories[cat];

            brandSelect.innerHTML = '<option value="">(Nenhuma / Não se aplica)</option>';

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

        // Attach event listener only if not attached
        if (!catSelect.dataset.listenerAttached) {
            catSelect.addEventListener('change', updateEditBrands);
            catSelect.dataset.listenerAttached = 'true';
        }

        document.getElementById('editId').value = product.id;
        document.getElementById('editUrl').value = product.url;
        document.getElementById('editName').value = product.name;
        document.getElementById('editCategory').value = product.category;

        updateEditBrands();
        document.getElementById('editBrand').value = product.brand || '';

        document.getElementById('editPrice').value = product.priceUSD;
        document.getElementById('editImage').value = product.image;

        document.getElementById('editModal').classList.add('active');
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
