const joinState = { code: null, shop: null };

const JoinIcons = {
    Scissors: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"></path></svg>`,
    Clock: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    CheckCircle: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    AlertCircle: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
};

function showToast(message, type = 'info', timeout = 3200) {
    let stack = document.getElementById('toasts');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toasts';
        stack.className = 'toast-stack';
        document.body.appendChild(stack);
    }
    const icons = { success: JoinIcons.CheckCircle, error: JoinIcons.AlertCircle, info: JoinIcons.AlertCircle };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="${type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-blue-500'}">${icons[type] || ''}</span><span class="flex-1">${message}</span>`;
    stack.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => toast.remove(), 260);
    }, timeout);
}

function formatWait(minutes) {
    if (minutes == null) return '—';
    if (minutes <= 0) return 'almost now';
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `~${h}h ${m}m` : `~${h}h`;
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function renderNotFound() {
    return `
    <div class="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center fade-in">
            <div class="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">${JoinIcons.AlertCircle}</div>
            <h1 class="text-2xl font-bold text-gray-800 mb-2">Shop not found</h1>
            <p class="text-gray-600">This QR code or link is invalid. Please ask the shop for a new one.</p>
        </div>
    </div>`;
}

function renderJoinForm() {
    const shop = joinState.shop;
    const noWait = shop.waiting_count === 0;
    return `
    <div class="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full fade-in">
            <div class="text-center mb-6">
                <div class="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">${JoinIcons.Scissors}</div>
                <h1 class="text-3xl font-bold text-gray-800">${esc(shop.name)}</h1>
                <div class="mt-3 ${noWait ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3">
                    <div class="flex items-center justify-center ${noWait ? 'text-green-800' : 'text-yellow-800'}">
                        ${noWait ? JoinIcons.CheckCircle : JoinIcons.Clock}
                        <span class="font-semibold ml-2">${noWait ? 'No wait — walk right in' : shop.waiting_count + ' waiting · est. ' + formatWait(shop.est_wait_minutes)}</span>
                    </div>
                </div>
                ${shop.now_serving ? `<div class="text-xs text-gray-500 mt-2">Now serving: ${esc(shop.now_serving)}</div>` : ''}
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Your name</label>
                    <input type="text" id="jName" placeholder="Enter your name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone number</label>
                    <input type="tel" id="jPhone" placeholder="For your text reminder" inputmode="tel" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Service</label>
                    <select id="jService" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        <option value="">Choose a service</option>
                        ${shop.services.map(s => `<option value="${s.id}">${esc(s.name)} — ₹${s.price} · ${s.duration} min</option>`).join('')}
                    </select>
                </div>
                <button id="joinBtn" onclick="handleJoin()" class="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition">Join the queue</button>
                <p class="text-xs text-gray-500 text-center">We'll text you before it's your turn. No app needed.</p>
            </div>
        </div>
    </div>`;
}

async function handleJoin() {
    const name = document.getElementById('jName').value.trim();
    const phone = document.getElementById('jPhone').value.trim();
    const serviceId = document.getElementById('jService').value;
    if (!name) return showToast('Please enter your name', 'error');
    if (!phone) return showToast('Please enter your phone number', 'error');
    if (!serviceId) return showToast('Please choose a service', 'error');

    const btn = document.getElementById('joinBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await fetch('/api/public/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinState.code, name, phone, service_id: serviceId })
    }).then(r => r.json());

    if (res.error) {
        showToast(res.error, 'error');
        btn.disabled = false;
        btn.textContent = 'Join the queue';
        return;
    }
    window.location.href = res.status_url;
}

function renderJoin() {
    document.getElementById('app').innerHTML = joinState.shop ? renderJoinForm() : renderNotFound();
}

document.addEventListener('DOMContentLoaded', () => {
    joinState.code = document.body.dataset.code;
    try {
        joinState.shop = JSON.parse(document.body.dataset.shop || 'null');
    } catch (e) {
        joinState.shop = null;
    }
    renderJoin();
});