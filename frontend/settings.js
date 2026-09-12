/**
 * TaskMaster - Application Settings & Preferences Module
 * File Modular: Mengelola tombol pengaturan sidebar & modal dialog "Coming Soon"
 */

let isSettingsModalOpen = false;

/**
 * Membuka modal pengaturan aplikasi
 */
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    isSettingsModalOpen = true;

    // Optional: Ambil status dari API backend jika token tersedia
    fetchSettingsStatus();
}

/**
 * Menutup modal pengaturan aplikasi
 */
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    modal.classList.add('hidden');
    isSettingsModalOpen = false;
}

/**
 * Mengambil preview konfigurasi dari API backend (jika tersedia)
 */
async function fetchSettingsStatus() {
    if (typeof apiFetch !== 'function' || typeof currentToken === 'undefined' || !currentToken) {
        return;
    }

    try {
        const data = await apiFetch(`${API_BASE}/settings`);
        console.log('[Settings Module] Connected to backend settings endpoint:', data);
    } catch (e) {
        // Fallback anggun tanpa mengganggu UI jika server offline
        console.log('[Settings Module] Running in standalone frontend mode.');
    }
}

/**
 * Inisialisasi event listener tombol pengaturan di sidebar & modal dialog
 */
function initSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-modal-btn');
    const dismissBtn = document.getElementById('dismiss-settings-btn');
    const modal = document.getElementById('settings-modal');

    // 1. Tombol buka di sidebar
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSettingsModal();
        });
    }

    // 2. Tombol tutup (silang)
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeSettingsModal();
        });
    }

    // 3. Tombol dismiss ("Saya Mengerti")
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            closeSettingsModal();
        });
    }

    // 4. Klik di luar kotak dialog untuk menutup
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSettingsModal();
            }
        });
    }

    // 5. Tekan tombol Escape di keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isSettingsModalOpen) {
            closeSettingsModal();
        }
    });
}

// Global exposure
window.initSettings = initSettings;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
