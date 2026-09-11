const dashState = {
    view: 'auth',
    authMode: 'login',
    shop: null,
    stats: null,
    qr: null,
    editing: false,
    poll: null
};

const DashAPI = {
    signup: (name, phone) => post('/api/owner/signup', { name, phone }),
    login: (code, pin) => post('/api/owner/login', { code, pin }),
    logout: () => post('/api/owner/logout', {}),
    shop: () => get('/api/owner/shop'),
    stats: () => get('/api/owner/stats'),
    qr: () => get('/api/owner/qr'),
    addService: (name, price, duration) => post('/api/owner/services', { name, price, duration }),
    deleteService: (id) => del(`/api/owner/services/${id}`),
    saveSettings: (payload) => post('/api/owner/settings', payload),
    start: () => post('/api/owner/start', {}),
    complete: () => post('/api/owner/complete', {})
};

async function get(url) { return (await fetch(url)).json(); }
async function post(url, body) {
    return (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
}
async function del(url) { return (await fetch(url, { method: 'DELETE' })).json(); }

const DIcons = {
    Users: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`,
    Clock: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    CheckCircle: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    AlertCircle: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    Settings: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
    Download: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`
};

function showToast(message, type = 'info', timeout = 3200) {
    let stack = document.getElementById('toasts');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toasts';
        stack.className = 'toast-stack';
        document.body.appendChild(stack);
    }
    const icons = { success: DIcons.CheckCircle, error: DIcons.AlertCircle, info: DIcons.AlertCircle };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="${type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-blue-500'}">${icons[type] || ''}</span><span class="flex-1">${message}</span>`;
    stack.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 260);
    }, timeout);
}

function copyText(text, msg = 'Copied') {
    const done = () => showToast(msg, 'success');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}

function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showToast('Copy failed', 'error'); }
    document.body.removeChild(ta);
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function renderAuth() {
    const isLogin = dashState.authMode === 'login';
    return `
    <div class="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full fade-in">
            <div class="text-center mb-8">
                <div class="brand-mark mx-auto mb-4" style="width:56px;height:56px;font-size:1.6rem;">✂️</div>
                <h1 class="text-3xl font-bold text-gray-800">${isLogin ? 'Shop owner login' : 'Create your shop'}</h1>
                <p class="text-gray-600 mt-2">${isLogin ? 'Enter your shop code and PIN' : 'Set up your virtual queue in seconds'}</p>
            </div>
            <div class="space-y-4">
                ${isLogin ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Shop code</label>
                        <input type="text" id="loginCode" placeholder="e.g. 7KQ2MP" autocomplete="off" style="text-transform:uppercase"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">PIN</label>
                        <input type="password" id="loginPin" placeholder="4-digit PIN" inputmode="numeric"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <button onclick="handleLogin()" class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">Log in</button>
                    <div class="text-center mt-4">
                        <button onclick="setAuthMode('signup')" class="text-indigo-600 text-sm hover:underline">New here? Create a shop</button>
                    </div>
                ` : `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Shop name</label>
                        <input type="text" id="signupName" placeholder="e.g. Fade Factory" 
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Contact phone <span class="text-gray-400">(optional)</span></label>
                        <input type="tel" id="signupPhone" placeholder="Shop phone number"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <button onclick="handleSignup()" class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">Create shop & QR</button>
                    <div class="text-center mt-4">
                        <button onclick="setAuthMode('login')" class="text-indigo-600 text-sm hover:underline">Already have a shop? Log in</button>
                    </div>
                `}
                <div class="text-center mt-4">
                    <a href="/" class="text-gray-500 text-xs hover:underline">Back to home</a>
                </div>
            </div>
        </div>
    </div>`;
}

function setAuthMode(mode) {
    dashState.authMode = mode;
    renderDash();
}

async function handleSignup() {
    const name = document.getElementById('signupName').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    if (!name) return showToast('Please enter a shop name', 'error');
    const res = await DashAPI.signup(name, phone);
    if (res.error) return showToast(res.error, 'error');
    await enterDashboard();
    showToast('Shop created! Your PIN is ' + res.pin + ' — save it now.', 'success', 12000);
}

async function handleLogin() {
    const code = document.getElementById('loginCode').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    if (!code || !pin) return showToast('Enter your shop code and PIN', 'error');
    const res = await DashAPI.login(code, pin);
    if (res.error) return showToast(res.error, 'error');
    await enterDashboard();
}

function renderDashboard() {
    const shop = dashState.shop;
    const stats = dashState.stats || { today_revenue: 0, today_customers: 0, avg_ticket: 0, service_breakdown: [] };
    const current = shop.current;
    const waiting = shop.waiting;

    return `
    <div class="min-h-screen bg-gray-50">
        <div class="bg-indigo-600 text-white p-6 shadow-lg">
            <div class="max-w-6xl mx-auto">
                <div class="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h1 class="text-2xl font-bold">${esc(shop.name)}</h1>
                        <p class="text-indigo-200 text-sm mt-1">Shop code: <span style="font-family:monospace;font-weight:700;letter-spacing:2px;">${esc(shop.code)}</span></p>
                    </div>
                    <div class="flex items-center gap-3 flex-wrap">
                        <div class="text-right mr-2">
                            <div class="text-2xl font-bold">₹${stats.today_revenue}</div>
                            <div class="text-xs text-indigo-200">Today's revenue</div>
                        </div>
                        <button onclick="toggleSettings()" class="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 flex items-center">
                            ${DIcons.Settings}<span class="ml-2">Settings</span>
                        </button>
                        <button onclick="handleLogout()" class="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700">Log out</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="max-w-6xl mx-auto p-6">
            ${dashState.editing ? renderSettings() : ''}

            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow p-4"><div class="text-2xl font-bold text-gray-800">${stats.today_customers}</div><div class="text-sm text-gray-600">Served today</div></div>
                <div class="bg-white rounded-lg shadow p-4"><div class="text-2xl font-bold text-gray-800">${waiting.length}</div><div class="text-sm text-gray-600">In queue</div></div>
                <div class="bg-white rounded-lg shadow p-4"><div class="text-2xl font-bold text-gray-800">₹${stats.avg_ticket}</div><div class="text-sm text-gray-600">Avg ticket</div></div>
            </div>

            ${renderQrCard(shop)}

            <div class="grid md:grid-cols-2 gap-6">
                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center mb-4">
                        <div class="text-green-600 mr-2">${DIcons.Users}</div>
                        <h2 class="text-xl font-bold text-gray-800">Now serving</h2>
                    </div>
                    ${current ? `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div class="text-2xl font-bold text-gray-800">${esc(current.name)}</div>
                            <div class="text-gray-600 mt-1">${esc(current.phone)}</div>
                            <div class="flex justify-between items-center mt-3 pt-3 border-t border-green-200">
                                <div><div class="text-sm text-gray-600">Service</div><div class="font-semibold">${esc(current.service_name)}</div></div>
                                <div class="text-right"><div class="text-sm text-gray-600">Price</div><div class="text-xl font-bold text-green-600">₹${current.price}</div></div>
                            </div>
                        </div>
                        <button onclick="handleComplete()" class="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center">
                            ${DIcons.CheckCircle}<span class="ml-2">Complete (₹${current.price})</span>
                        </button>
                    ` : `
                        <div class="text-center py-8 text-gray-400">
                            <div class="mx-auto mb-2 opacity-50">${DIcons.Users}</div>
                            <p>No one being served</p>
                            ${waiting.length > 0 ? `<button onclick="handleStart()" class="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">Start next customer</button>` : ''}
                        </div>
                    `}
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center"><div class="text-indigo-600 mr-2">${DIcons.Clock}</div><h2 class="text-xl font-bold text-gray-800">Waiting queue</h2></div>
                        <div class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-bold">${waiting.length}</div>
                    </div>
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                        ${waiting.length === 0 ? `
                            <div class="text-center py-8 text-gray-400"><div class="mx-auto mb-2 opacity-50">${DIcons.Users}</div><p>Queue is empty</p></div>
                        ` : waiting.map((c, i) => `
                            <div class="border border-gray-200 rounded-lg p-4">
                                <div class="flex items-start">
                                    <div class="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3">${i + 1}</div>
                                    <div>
                                        <div class="font-semibold text-gray-800">${esc(c.name)}</div>
                                        <div class="text-sm text-gray-600">${esc(c.phone)}</div>
                                        <div class="text-sm text-indigo-600 font-semibold mt-1">${esc(c.service_name)} — ₹${c.price}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            ${renderBreakdown(stats)}
        </div>
    </div>`;
}

function renderQrCard(shop) {
    return `
    <div class="bg-white rounded-xl shadow-md p-6 mb-6">
        <div class="flex items-center justify-between flex-wrap gap-6">
            <div class="flex-1" style="min-width:260px;">
                <h2 class="text-xl font-bold text-gray-800 mb-2">Your queue QR code</h2>
                <p class="text-gray-600 mb-4">Print this and place it at your counter or window. Customers scan it to join — no code to type.</p>
                <div class="share-row mb-3">
                    <span class="copy-field">${esc(shop.join_url)}</span>
                    <button onclick="copyText('${esc(shop.join_url)}', 'Link copied')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700">Copy link</button>
                </div>
                <a href="/api/owner/qr?format=svg" download="cutnow-qr.svg" class="btn btn-ghost btn-sm" style="text-decoration:none;">${DIcons.Download}<span class="ml-2">Download SVG</span></a>
            </div>
            <div class="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200 text-center">
                ${dashState.qr ? `<img src="${dashState.qr}" alt="Queue QR" style="width:170px;height:170px;">` : `<div class="skeleton" style="width:170px;height:170px;"></div>`}
                <div class="text-xs text-gray-500 mt-2">Scan to join</div>
            </div>
        </div>
    </div>`;
}

function renderBreakdown(stats) {
    return `
    <div class="bg-white rounded-xl shadow-md p-6 mt-6">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Today's services</h2>
        ${stats.service_breakdown.length ? stats.service_breakdown.map(s => `
            <div class="flex justify-between items-center border-b pb-3 mb-3">
                <div><div class="font-semibold text-gray-800">${esc(s.name)}</div><div class="text-sm text-gray-600">${s.count} services</div></div>
                <div class="text-xl font-bold text-green-600">₹${s.revenue}</div>
            </div>
        `).join('') : `<div class="text-center text-gray-400 py-6">No services completed yet today</div>`}
    </div>`;
}

function renderSettings() {
    const shop = dashState.shop;
    return `
    <div class="bg-white rounded-xl shadow-md p-6 mb-6 fade-in">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-800">Settings</h2>
            <button onclick="toggleSettings()" class="text-gray-500 hover:underline text-sm">Close</button>
        </div>
        <div class="grid md:grid-cols-2 gap-6">
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Shop name</label>
                    <input type="text" id="setName" value="${esc(shop.name)}" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Contact phone</label>
                    <input type="tel" id="setPhone" value="${esc(shop.phone || '')}" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                </div>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" id="setReminders" ${shop.reminder_enabled ? 'checked' : ''}> Send automatic text reminders
                </label>
                <button onclick="handleSaveSettings()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Save</button>
            </div>
            <div>
                <h3 class="font-semibold text-gray-800 mb-3">Services & pricing</h3>
                <div class="space-y-2 mb-4">
                    ${shop.services.map(s => `
                        <div class="flex justify-between items-center border border-gray-200 rounded-lg p-3">
                            <div><div class="font-semibold">${esc(s.name)}</div><div class="text-sm text-gray-600">₹${s.price} · ${s.duration} min</div></div>
                            <button onclick="handleDeleteService(${s.id})" class="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <input type="text" id="nsName" placeholder="Service name" class="px-3 py-2 border border-gray-300 rounded-lg">
                    <input type="number" id="nsPrice" placeholder="Price ₹" class="px-3 py-2 border border-gray-300 rounded-lg">
                    <input type="number" id="nsDuration" placeholder="Minutes" class="px-3 py-2 border border-gray-300 rounded-lg">
                    <button onclick="handleAddService()" class="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700">Add</button>
                </div>
            </div>
        </div>
    </div>`;
}

async function enterDashboard() {
    dashState.view = 'dashboard';
    const res = await DashAPI.shop();
    if (res.error) {
        dashState.view = 'auth';
        renderDash();
        return;
    }
    dashState.shop = res;
    await refreshData();
    startPolling();
}

async function refreshData() {
    const [shopRes, statsRes, qrRes] = await Promise.all([DashAPI.shop(), DashAPI.stats(), DashAPI.qr()]);
    if (shopRes.error) {
        dashState.view = 'auth';
        renderDash();
        return;
    }
    dashState.shop = shopRes;
    dashState.stats = statsRes;
    if (qrRes && qrRes.data_uri) dashState.qr = qrRes.data_uri;
    renderDash();
}

function startPolling() {
    stopPolling();
    dashState.poll = setInterval(async () => {
        if (dashState.view !== 'dashboard' || dashState.editing) return;
        const res = await DashAPI.shop();
        if (!res.error) {
            dashState.shop = res;
            dashState.stats = await DashAPI.stats();
            renderDash();
        }
    }, 4000);
}

function stopPolling() {
    if (dashState.poll) {
        clearInterval(dashState.poll);
        dashState.poll = null;
    }
}

async function handleStart() {
    const res = await DashAPI.start();
    if (res.error) return showToast(res.error, 'error');
    showToast('Now serving ' + res.current.name, 'success');
    await refreshData();
}

async function handleComplete() {
    const res = await DashAPI.complete();
    if (res.error) return showToast(res.error, 'error');
    showToast('Completed ' + res.completed.service_name + ' · ₹' + res.completed.price, 'success');
    await refreshData();
}

async function handleAddService() {
    const name = document.getElementById('nsName').value.trim();
    const price = document.getElementById('nsPrice').value;
    const duration = document.getElementById('nsDuration').value;
    if (!name || !price || !duration) return showToast('Fill all service fields', 'error');
    const res = await DashAPI.addService(name, price, duration);
    if (res.error) return showToast(res.error, 'error');
    showToast('Service added', 'success');
    dashState.editing = true;
    await refreshData();
    dashState.editing = true;
    renderDash();
}

async function handleDeleteService(id) {
    if (!confirm('Remove this service?')) return;
    await DashAPI.deleteService(id);
    showToast('Service removed', 'success');
    dashState.editing = true;
    await refreshData();
    dashState.editing = true;
    renderDash();
}

async function handleSaveSettings() {
    const name = document.getElementById('setName').value.trim();
    const phone = document.getElementById('setPhone').value.trim();
    const reminder_enabled = document.getElementById('setReminders').checked;
    const res = await DashAPI.saveSettings({ name, phone, reminder_enabled });
    if (res.error) return showToast(res.error, 'error');
    showToast('Settings saved', 'success');
    dashState.editing = true;
    await refreshData();
    dashState.editing = true;
    renderDash();
}

function toggleSettings() {
    dashState.editing = !dashState.editing;
    renderDash();
}

async function handleLogout() {
    stopPolling();
    await DashAPI.logout();
    dashState.shop = null;
    dashState.qr = null;
    dashState.view = 'auth';
    dashState.authMode = 'login';
    renderDash();
}

function renderDash() {
    document.getElementById('app').innerHTML = dashState.view === 'dashboard' ? renderDashboard() : renderAuth();
}

document.addEventListener('DOMContentLoaded', async () => {
    const res = await DashAPI.shop();
    if (!res.error) {
        dashState.view = 'dashboard';
        dashState.shop = res;
        await refreshData();
        startPolling();
    } else {
        renderDash();
    }
});