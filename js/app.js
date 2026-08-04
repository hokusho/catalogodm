document.addEventListener('DOMContentLoaded', async () => {
    // Auth check for protected pages (dados.html)
    const isProtectedPage = document.body.dataset.page !== 'catalog';
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

    // Calculation logic uses calculatePrices from db.js with currentDollarAPI
    function getAppPrices(priceUSD, url) {
        if (!currentDollarAPI) return { sn: 'Carregando...', nf: 'Carregando...' };
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

        const products = await getProducts();
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
        filteredProducts.sort((a, b) => a.priceUSD - b.priceUSD);

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Nenhum produto encontrado.</p>';
            return;
        }

        const isCatalog = document.body.dataset.page === 'catalog';

        filteredProducts.forEach(product => {
            const prices = getAppPrices(product.priceUSD, product.url);


            let origin = 'Outros';
            if (product.url.includes('amazon.')) origin = 'US-AM';
            else if (product.url.includes('bhphotovideo.com')) origin = 'US-BH';
            else if (product.url.includes('comprasparaguai.com.br')) origin = 'MS';



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
                    <input type="text" id="editUrl">
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
                        <option value="microfone">Microfone</option>
                        <option value="outro">Outro</option>
                    </select>
                </div>
                <div class="form-group" id="editBrandGroup" style="display: none;">
                    <label>Marca / Subcategoria</label>
                    <select id="editBrand">
                        <option value="">(Nenhuma / Não se aplica)</option>
                    </select>
                </div>
                <div class="form-group" id="editBrandGroup2" style="display: none;">
                    <label>Compatibilidade / Subcategoria 2</label>
                    <select id="editBrand2">
                        <option value="">(Nenhuma / Não se aplica)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Origem / Regra de Cálculo de Preço</label>
                    <select id="editRule">
                        <option value="standard">Preços US (Amazon / B&H Photo)</option>
                        <option value="paraguai">Compras Paraguai (MS)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Preço Base (USD)</label>
                    <input type="number" step="0.01" id="editPrice" required>
                </div>

                <!-- Painel de Prévia do Preço Calculado (Edição) -->
                <div class="price-preview-container" id="editPricePreviewContainer" style="margin: 1rem 0;">
                    <div class="price-preview-header">
                        <span>Prévia de Preço Final (Edição)</span>
                        <span id="editPreviewDollarRate" class="dollar-tag">Dólar API: R$ --</span>
                    </div>
                    <div class="price-preview-grid">
                        <div class="preview-card highlight">
                            <span class="preview-label">Preço Recibo (SN)</span>
                            <span class="preview-value" id="editPreviewPriceSN">R$ 0,00</span>
                        </div>
                        <div class="preview-card">
                            <span class="preview-label">Preço Nota Fiscal (NF)</span>
                            <span class="preview-value" id="editPreviewPriceNF">R$ 0,00</span>
                        </div>
                    </div>
                    <div class="preview-footer">
                        <span>Regra Aplicada: <strong id="editPreviewRuleText">Padrão</strong></span>
                    </div>
                </div>

                <div class="form-group">
                    <label>URL ou Arquivo da Foto (Convertida para 300px WebP)</label>
                    <input type="text" id="editImage" required>
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Trocar por foto do computador:</span>
                        <input type="file" id="editImageFile" accept="image/*" style="font-size: 0.8rem; padding: 0.3rem;">
                    </div>
                    <div id="editImagePreviewContainer" style="margin-top: 0.8rem; text-align: center; background: rgba(0,0,0,0.3); padding: 0.8rem; border-radius: 8px; border: 1px solid var(--card-border);">
                        <img id="editImagePreview" src="" alt="Prévia" style="max-height: 150px; width: auto; object-fit: contain; border-radius: 6px; background: #fff; padding: 4px;">
                    </div>
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

    // Atualização em tempo real dos preços no Modal de Edição
    function updateEditPricePreview() {
        const priceInput = document.getElementById('editPrice');
        const ruleSelect = document.getElementById('editRule');
        const priceSNEl = document.getElementById('editPreviewPriceSN');
        const priceNFEl = document.getElementById('editPreviewPriceNF');
        const dollarRateEl = document.getElementById('editPreviewDollarRate');
        const ruleTextEl = document.getElementById('editPreviewRuleText');

        if (!priceInput || !priceSNEl || !priceNFEl) return;

        if (dollarRateEl && currentDollarAPI) {
            dollarRateEl.textContent = `Dólar API: R$ ${currentDollarAPI.toFixed(2).replace('.', ',')}`;
        }

        const priceUSD = parseFloat(priceInput.value);
        const ruleVal = ruleSelect ? ruleSelect.value : 'standard';
        const virtualUrl = (ruleVal === 'paraguai') ? 'comprasparaguai.com.br' : 'bhphotovideo.com';

        const prices = calculatePrices(priceUSD, virtualUrl, currentDollarAPI);

        priceSNEl.textContent = prices.sn;
        priceNFEl.textContent = prices.nf;
        if (ruleTextEl) ruleTextEl.textContent = prices.rule;
    }

    const editPriceInput = document.getElementById('editPrice');
    const editRuleSelect = document.getElementById('editRule');

    if (editPriceInput) {
        editPriceInput.addEventListener('input', updateEditPricePreview);
        editPriceInput.addEventListener('change', updateEditPricePreview);
    }
    if (editRuleSelect) {
        editRuleSelect.addEventListener('change', updateEditPricePreview);
    }

    const editImageFileInput = document.getElementById('editImageFile');
    const editImageInput = document.getElementById('editImage');
    const editPreviewImg = document.getElementById('editImagePreview');

    if (editImageFileInput) {
        editImageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    showToast("Otimizando nova foto para WebP 300px...");
                    const webp = await downloadAndOptimizeImage(event.target.result);
                    if (editImageInput) editImageInput.value = webp;
                    if (editPreviewImg) editPreviewImg.src = webp;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (editImageInput) {
        editImageInput.addEventListener('change', async (e) => {
            const val = e.target.value;
            if (val && !val.startsWith('data:image/webp')) {
                showToast("Otimizando imagem para WebP 300px...");
                const webp = await downloadAndOptimizeImage(val);
                editImageInput.value = webp;
                if (editPreviewImg) editPreviewImg.src = webp;
            }
        });
    }

    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        let rawImage = document.getElementById('editImage').value;
        
        if (rawImage && !rawImage.startsWith('data:image/webp')) {
            showToast("Otimizando imagem antes de salvar...");
            rawImage = await downloadAndOptimizeImage(rawImage);
        }

        let url = document.getElementById('editUrl').value;
        const selectedRule = document.getElementById('editRule').value;

        // Garante que a regra escolhida fique marcada e persistida no banco Neon
        if (selectedRule === 'paraguai') {
            if (!url || !url.toLowerCase().includes('comprasparaguai')) {
                url = 'https://comprasparaguai.com.br/' + (url ? url.replace(/^https?:\/\//i, '') : '');
            }
        } else if (selectedRule === 'standard') {
            if (url && url.toLowerCase().includes('comprasparaguai')) {
                url = 'https://bhphotovideo.com/' + url.replace(/^https?:\/\/(www\.)?comprasparaguai\.com\.br\/?/i, '');
            }
        }

        let brandVal = document.getElementById('editBrand').value;
        const brandVal2 = document.getElementById('editBrand2') ? document.getElementById('editBrand2').value : '';
        if (brandVal2) brandVal = `${brandVal},${brandVal2}`;

        const updatedData = {
            url,
            name: document.getElementById('editName').value,
            category: document.getElementById('editCategory').value,
            brand: brandVal,
            priceUSD: parseFloat(document.getElementById('editPrice').value),
            image: rawImage
        };


        await updateProduct(id, updatedData);
        modal.classList.remove('active');
        showToast("Produto atualizado com sucesso!");
        await renderProducts(getCurrentCategory());
    });
}



function openEditModal(product) {
    createModalHTML();

    const catSelect = document.getElementById('editCategory');
    const brandSelect = document.getElementById('editBrand');
    const brandGroup = document.getElementById('editBrandGroup');
    const brandSelect2 = document.getElementById('editBrand2');
    const brandGroup2 = document.getElementById('editBrandGroup2');

    const updateEditBrands = () => {
        const cat = catSelect.value;
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

    // Attach event listener only if not attached
    if (!catSelect.dataset.listenerAttached) {
        catSelect.addEventListener('change', updateEditBrands);
        
        brandSelect.addEventListener('change', () => {
            if (brandGroup2 && brandSelect2 && catSelect.value === 'lente') {
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
        
        catSelect.dataset.listenerAttached = 'true';
    }

    document.getElementById('editId').value = product.id;
    document.getElementById('editUrl').value = product.url;
    document.getElementById('editName').value = product.name;
    document.getElementById('editCategory').value = product.category;

    updateEditBrands();
    
    let dbBrand = product.brand || '';
    let dbBrand2 = '';
    if (dbBrand.includes(',')) {
        const parts = dbBrand.split(',');
        dbBrand = parts[0];
        dbBrand2 = parts[1];
    }
    
    document.getElementById('editBrand').value = dbBrand;
    brandSelect.dispatchEvent(new Event('change'));
    if (brandSelect2 && dbBrand2) {
        brandSelect2.value = dbBrand2;
    }

    document.getElementById('editPrice').value = product.priceUSD;
    document.getElementById('editImage').value = product.image;
    
    const editRuleSelect = document.getElementById('editRule');
    if (editRuleSelect) {
        if (product.url && product.url.includes('comprasparaguai')) {
            editRuleSelect.value = 'paraguai';
        } else {
            editRuleSelect.value = 'standard';
        }
    }

    const editPreviewImg = document.getElementById('editImagePreview');
    if (editPreviewImg) {
        editPreviewImg.src = product.image;
    }

    // Dispara atualização inicial da conversão de preço
    const editPriceInput = document.getElementById('editPrice');
    if (editPriceInput) {
        editPriceInput.dispatchEvent(new Event('input'));
    }

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
