document.addEventListener('DOMContentLoaded', async () => {
    const productsGrid = document.getElementById('products-grid');
    const dollarDisplay = document.getElementById('dollar-display');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    let currentDollarAPI = 5.00;
    
    // Initialize
    async function init() {
        currentDollarAPI = await getDollarRate();
        
        if (dollarDisplay) {
            dollarDisplay.textContent = `Cotação Dólar (API): R$ ${currentDollarAPI.toFixed(2).replace('.', ',')}`;
        }
        
        renderProducts('all');
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
            nf: formatCurrency(nfPrice)
        };
    }

    function renderProducts(categoryFilter) {
        if (!productsGrid) return;
        
        const products = getProducts();
        productsGrid.innerHTML = '';

        const filteredProducts = categoryFilter === 'all' 
            ? products 
            : products.filter(p => p.category === categoryFilter);

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
                    <span class="product-category">${product.category}</span>
                    <img src="${product.image}" alt="${product.name}" class="product-img" onerror="this.src='https://via.placeholder.com/250?text=Sem+Foto'">
                </div>
                <div class="product-info">
                    <a href="${product.url}" target="_blank" style="color: inherit; text-decoration: none;">
                        <h3 class="product-name" title="${product.name}">${product.name}</h3>
                    </a>
                    
                    ${adminInfoHTML}
                    
                    <div class="price-container">
                        <div class="price-row">
                            <span class="price-label">Preço SN</span>
                            <span class="price-value">${prices.sn}</span>
                        </div>
                        <div class="price-row highlight">
                            <span class="price-label">Preço NF</span>
                            <span class="price-value">${prices.nf}</span>
                        </div>
                    </div>
                    
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
        document.getElementById('editId').value = product.id;
        document.getElementById('editUrl').value = product.url;
        document.getElementById('editName').value = product.name;
        document.getElementById('editCategory').value = product.category;
        document.getElementById('editPrice').value = product.priceUSD;
        document.getElementById('editImage').value = product.image;
        
        document.getElementById('editModal').classList.add('active');
    }

    // Filter Logic
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderProducts(e.target.dataset.category);
        });
    });

    init();
});
