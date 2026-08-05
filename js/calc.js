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

// Modal Edit Logic (Admin / Gerenciar - Dados.html)
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

        if (dollarRateEl && typeof currentDollarAPI !== 'undefined' && currentDollarAPI) {
            dollarRateEl.textContent = `Dólar API: R$ ${currentDollarAPI.toFixed(2).replace('.', ',')}`;
        }

        const priceUSD = parseFloat(priceInput.value);
        const ruleVal = ruleSelect ? ruleSelect.value : 'standard';
        const virtualUrl = (ruleVal === 'paraguai') ? 'comprasparaguai.com.br' : 'bhphotovideo.com';

        const prices = calculatePrices(priceUSD, virtualUrl, typeof currentDollarAPI !== 'undefined' ? currentDollarAPI : 5.00);

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
        if (typeof renderProducts === 'function') {
            const activeBtn = document.querySelector('.filter-btn.active');
            const currentCat = activeBtn ? activeBtn.dataset.category : 'all';
            await renderProducts(currentCat);
        }
    });
}

function openEditModal(product) {
    createModalHTML();

    const catSelect = document.getElementById('editCategory');
    const brandSelect = document.getElementById('editBrand');
    const brandGroup = document.getElementById('editBrandGroup');
    const brandSelect2 = document.getElementById('editBrand2');
    const brandGroup2 = document.getElementById('editBrandGroup2');

    const subCategories = {
        camera: ['CANON', 'SONY', 'NIKON'],
        lente: ['CANON', 'SONY', 'NIKON', 'SIGMA', 'TAMROM', 'OUTRAS'],
        cartao: ['SANDISK', 'LEXAR'],
        flash: ['GODOX'],
        microfone: ['SEM FIO']
    };

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

    const editPriceInput = document.getElementById('editPrice');
    if (editPriceInput) {
        editPriceInput.dispatchEvent(new Event('input'));
    }

    document.getElementById('editModal').classList.add('active');
}

