const statusState = {
    token: null,
    data: null,
    poll: null
};

const StatusIcons = {
    Clock: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    CheckCircle: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    Users: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`,
    Bell: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>`,
    AlertCircle: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
};

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
            <div class="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">${StatusIcons.AlertCircle}</div>
            <h1 class="text-2xl font-bold text-gray-800 mb-2">Status not found</h1>
            <p class="text-gray-600">This link is invalid or has expired.</p>
        </div>
    </div>`;
}

function renderStatus() {
    const d = statusState.data;
    if (!d) return renderNotFound();

    if (d.status === 'done') {
        return `
        <div class="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center fade-in">
                <div class="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">${StatusIcons.CheckCircle}</div>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">All done, ${esc(d.name)}!</h2>
                <p class="text-gray-600">Thanks for visiting. Hope you love the ${esc(d.service)}.</p>
            </div>
        </div>`;
    }

    if (d.status === 'serving') {
        return `
        <div class="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center fade-in">
                <div class="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">${StatusIcons.Bell}</div>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">It's your turn, ${esc(d.name)}!</h2>
                <p class="text-gray-600">Please head to the chair for your ${esc(d.service)}.</p>
            </div>
        </div>`;
    }

    const pos = d.position || 0;
    const progress = pos > 0 ? Math.max(8, Math.round((1 / pos) * 100)) : 0;
    const isNext = d.people_ahead === 0;
    return `
    <div class="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center fade-in">
            <div class="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">${StatusIcons.Users}</div>
            <h2 class="text-2xl font-bold text-gray-800 mb-1">You're in line, ${esc(d.name)}</h2>
            <p class="text-gray-600 mb-6">${isNext ? "You're up next — head to the shop now" : "We'll text you before it's your turn"}</p>
            <div class="bg-purple-50 rounded-lg p-6 mb-6">
                <div class="text-5xl font-bold text-purple-600 mb-1">#${pos}</div>
                <div class="text-sm text-gray-600 mb-4">Your position</div>
                <div class="progress-track mb-4"><div class="progress-fill" style="width:${progress}%"></div></div>
                <div class="flex items-center justify-center text-gray-700 mb-3">${StatusIcons.Clock}<span class="font-semibold ml-2">Estimated wait: ${formatWait(d.eta_minutes)}</span></div>
                <div class="border-t border-purple-200 pt-3 mt-3">
                    <div class="text-sm text-gray-600">Your service</div>
                    <div class="font-semibold text-gray-800">${esc(d.service)}</div>
                </div>
                <div class="text-xs text-gray-500 mt-3">${isNext ? "You're first in line" : d.people_ahead + ' ' + (d.people_ahead === 1 ? 'person' : 'people') + ' ahead of you'}</div>
            </div>
            <p class="text-xs text-gray-400">This page updates automatically. Keep it open or check the link we sent.</p>
        </div>
    </div>`;
}

function renderStatusPage() {
    document.getElementById('app').innerHTML = renderStatus();
}

async function pollStatus() {
    const res = await fetch(`/api/public/entry/${statusState.token}`).then(r => r.json());
    if (!res.error) {
        const prev = statusState.data;
        statusState.data = res;
        renderStatusPage();
        if (prev && prev.status === 'waiting' && res.status === 'serving') {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    statusState.token = document.body.dataset.token;
    try {
        const entry = JSON.parse(document.body.dataset.entry || 'null');
        if (entry) statusState.data = { status: 'waiting', name: entry.name, service: entry.service };
    } catch (e) {}
    renderStatusPage();
    pollStatus();
    statusState.poll = setInterval(pollStatus, 5000);
});