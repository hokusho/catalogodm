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
