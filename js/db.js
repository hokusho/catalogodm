// Strict API Database Utility - Direct connection to Vercel/Prisma/Neon API
var API_URL = '/api/products';
var AUTH_API_URL = '/api/auth';
var AUTH_TOKEN_KEY = 'catalogodm_auth_token';

// ========== Auth Helpers ==========

function getAuthToken() {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function getAuthHeaders() {
    var token = getAuthToken();
    if (token) {
        return { 'Authorization': 'Bearer ' + token };
    }
    return {};
}

async function loginAdmin(user, password) {
    var response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user, password: password })
    });
    if (!response.ok) {
        var data = await response.json().catch(function() { return {}; });
        throw new Error(data.error || 'Credenciais inválidas');
    }
    var data = await response.json();
    setAuthToken(data.token);
    return true;
}

async function validateToken() {
    var token = getAuthToken();
    if (!token) return false;
    try {
        var response = await fetch(AUTH_API_URL, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) return true;
        clearAuthToken();
        return false;
    } catch (e) {
        return false;
    }
}

function setupLoginModal() {
    var loginModal = document.getElementById('loginModal');
    var protectedContent = document.getElementById('protectedContent');
    var loginForm = document.getElementById('loginForm');
    var loginError = document.getElementById('loginError');

    if (loginModal) loginModal.classList.add('active');
    if (protectedContent) protectedContent.style.display = 'none';

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var user = document.getElementById('loginUser').value;
            var password = document.getElementById('loginPassword').value;
            var submitBtn = loginForm.querySelector('button[type="submit"]');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Entrando...';
            }

            try {
                await loginAdmin(user, password);
                window.location.reload();
            } catch (err) {
                if (loginError) {
                    loginError.textContent = 'Usuário ou senha incorretos';
                    loginError.style.display = 'block';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
                }
            }
        });
    }
}

// ========== HTML Sanitization ==========

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function sanitizeImageUrl(url) {
    if (!url) return '';
    var s = String(url).trim();
    if (s.startsWith('data:image/')) return s;
    if (s.startsWith('https://') || s.startsWith('http://')) return s;
    return '';
}

// ========== API Functions ==========

async function getProducts() {
    try {
        var response = await fetch(API_URL, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            var errorData = await response.json().catch(function() { return {}; });
            var msg = errorData.error || 'Erro ao buscar produtos';
            showToast('Erro Banco Neon (GET): ' + msg, true);
            return [];
        }
        var data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        showToast('Erro Conexão API: ' + err.message, true);
        return [];
    }
}

async function getCatalogProducts() {
    try {
        var response = await fetch(API_URL + '?catalog=true');
        if (!response.ok) {
            var errorData = await response.json().catch(function() { return {}; });
            var msg = errorData.error || 'Erro ao buscar produtos';
            showToast('Erro (GET catálogo): ' + msg, true);
            return [];
        }
        var data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        showToast('Erro Conexão API: ' + err.message, true);
        return [];
    }
}

async function saveProduct(product) {
    try {
        var headers = { 'Content-Type': 'application/json' };
        var authHeaders = getAuthHeaders();
        for (var key in authHeaders) {
            headers[key] = authHeaders[key];
        }

        var response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(product)
        });
        
        if (!response.ok) {
            var errorData = await response.json().catch(function() { return {}; });
            var msg = errorData.error || 'Erro ao salvar';
            showToast('ERRO BANCO NEON: ' + msg, true);
            throw new Error('Falha ao salvar no Neon: ' + msg);
        }
        
        var saved = await response.json();
        return saved;
    } catch (err) {
        showToast('ERRO CONEXÃO API: ' + err.message, true);
        throw err;
    }
}

async function deleteProduct(id) {
    try {
        var response = await fetch(API_URL + '?id=' + encodeURIComponent(id), {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            var errorData = await response.json().catch(function() { return {}; });
            var msg = errorData.error || 'Erro ao remover';
            showToast('ERRO BANCO NEON: ' + msg, true);
            throw new Error('Falha ao remover no Neon: ' + msg);
        }
        
        return true;
    } catch (err) {
        showToast('ERRO CONEXÃO API: ' + err.message, true);
        throw err;
    }
}

async function updateProduct(id, updatedData) {
    try {
        var headers = { 'Content-Type': 'application/json' };
        var authHeaders = getAuthHeaders();
        for (var key in authHeaders) {
            headers[key] = authHeaders[key];
        }

        var response = await fetch(API_URL, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ id: id, ...updatedData })
        });
        
        if (!response.ok) {
            var errorData = await response.json().catch(function() { return {}; });
            var msg = errorData.error || 'Erro ao atualizar';
            showToast('ERRO BANCO NEON: ' + msg, true);
            throw new Error('Falha ao atualizar no Neon: ' + msg);
        }
        
        var updated = await response.json();
        return updated;
    } catch (err) {
        showToast('ERRO CONEXÃO API: ' + err.message, true);
        throw err;
    }
}



// Global Toast Notification
function showToast(message, isError) {
    if (isError === undefined) isError = false;
    var toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(function() {
        toast.classList.remove('show');
    }, 3000);
}

// getDollarRate() and calculatePrices() moved to js/calc.js (admin-only)
// For the catalog page, prices are calculated server-side via /api/products?catalog=true

// Global Image Downloader & 300px WebP Optimizer
async function downloadAndOptimizeImage(imageUrl) {
    if (!imageUrl) return '';

    var blob = null;

    if (imageUrl.startsWith('data:')) {
        try {
            var res = await fetch(imageUrl);
            blob = await res.blob();
        } catch (e) {
            // Data URL conversion failed
        }
    } else {
        // Tenta baixar via CORS proxy
        try {
            var corsUrl = 'https://corsproxy.io/?' + encodeURIComponent(imageUrl);
            var res = await fetch(corsUrl);
            if (res.ok) {
                blob = await res.blob();
            }
        } catch (e) {
            // CORS proxy failed, trying direct fetch
        }

        if (!blob) {
            try {
                var res = await fetch(imageUrl);
                if (res.ok) blob = await res.blob();
            } catch (e) {
                // Direct fetch failed
            }
        }
    }

    return new Promise(function(resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';

        var processCanvas = function() {
            try {
                var targetHeight = 300;
                var aspect = (img.width && img.height) ? (img.width / img.height) : 1;
                var targetWidth = Math.round(targetHeight * aspect);

                var canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                var ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                var webpUrl = canvas.toDataURL('image/webp', 0.82);
                if (!webpUrl.startsWith('data:image/webp')) {
                    webpUrl = canvas.toDataURL('image/jpeg', 0.82);
                }
                resolve(webpUrl);
            } catch (err) {
                resolve(imageUrl);
            }
        };

        if (blob) {
            var objectUrl = URL.createObjectURL(blob);
            img.onload = function() {
                URL.revokeObjectURL(objectUrl);
                processCanvas();
            };
            img.onerror = function() {
                URL.revokeObjectURL(objectUrl);
                resolve(imageUrl);
            };
            img.src = objectUrl;
        } else {
            img.onload = processCanvas;
            img.onerror = function() { resolve(imageUrl); };
            img.src = imageUrl;
        }
    });
}
