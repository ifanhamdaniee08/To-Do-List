/**
 * TaskMaster - Frontend Application Logic
 * Modern Productivity Dashboard (Notion / ClickUp Style)
 */

const API_BASE = '/api';

// --- APPLICATION STATE ---
let currentUser = null;
let currentToken = localStorage.getItem('token');
let tasks = [];
let currentView = 'todo-view';
let currentCategoryFilter = 'all';
let currentStatusFilter = 'all';
let searchQuery = '';
let calendarDate = new Date(); // Current viewing month/year for Calendar View
let calendarCategoryFilter = 'all'; // Kategori 2: Filter Proyek Kalender
let draggedTaskId = null; // Kategori 2: Drag and Drop Reschedule

// --- DOM ELEMENTS ---
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authAlert = document.getElementById('auth-alert');
const authAlertMsg = document.getElementById('auth-alert-msg');
const authAlertClose = document.getElementById('auth-alert-close');
const toastEl = document.getElementById('toast');
const taskModal = document.getElementById('task-modal');
const modalForm = document.getElementById('modal-task-form');

// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    initNotes();
    if (typeof initProductivityStats === 'function') {
        initProductivityStats();
    }
    if (typeof initSettings === 'function') {
        initSettings();
    }
    initGoogleAuth();
    if (new URLSearchParams(window.location.search).has('logout')) {
        logout(false);
    } else if (currentToken) {
        fetchMe();
    } else {
        switchMainView('auth-view');
    }
}

// --- NOTIFICATION HELPER ---
function showToast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.style.borderLeft = `4px solid ${isError ? 'var(--danger)' : 'var(--success)'}`;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function safeEscape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function showAuthAlert(message, isError = true) {
    if (!authAlert || !authAlertMsg) return;
    authAlertMsg.innerHTML = message;
    authAlert.className = `auth-alert ${isError ? 'auth-alert-error' : 'auth-alert-success'}`;
    authAlert.classList.remove('hidden');

    if (isError) {
        const activeForm = document.querySelector('.auth-form:not(.hidden)');
        if (activeForm) {
            activeForm.classList.remove('shake');
            void activeForm.offsetWidth; // force DOM reflow
            activeForm.classList.add('shake');

            const inputs = activeForm.querySelectorAll('input');
            inputs.forEach(input => input.classList.add('input-error'));
        }
    }
}

function clearAuthAlert() {
    if (authAlert) {
        authAlert.classList.add('hidden');
    }
    document.querySelectorAll('.auth-form input').forEach(input => {
        input.classList.remove('input-error');
    });
}

// --- VIEW SWITCHERS ---
function switchMainView(viewId) {
    if (viewId === 'app-view') {
        authView.classList.add('hidden');
        authView.classList.remove('active');
        appView.classList.remove('hidden');
        appView.classList.add('active');
    } else {
        appView.classList.add('hidden');
        appView.classList.remove('active');
        authView.classList.remove('hidden');
        authView.classList.add('active');
    }
}

function switchTab(viewId) {
    currentView = viewId;
    document.querySelectorAll('.top-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewId);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === viewId);
        panel.classList.toggle('hidden', panel.id !== viewId);
    });

    if (viewId === 'calendar-view') {
        renderCalendar();
    } else if (viewId === 'project-view') {
        renderProjects();
    } else if (viewId === 'todo-view') {
        renderTasks();
    } else if (viewId === 'notes-view') {
        renderNotesList();
        if (activeNoteId) {
            selectNote(activeNoteId);
        } else {
            showEmptyNotesEditor();
        }
    }
}

// --- API FETCH WRAPPER ---
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
        const response = await fetch(endpoint, { ...options, headers });
        let data = {};
        try {
            data = await response.json();
        } catch (jsonErr) {
            data = {};
        }

        if (!response.ok) {
            // Flask-JWT-Extended uses 'msg', standard endpoints use 'message'
            let errorMsg = data.message || data.msg;

            if (!errorMsg) {
                if (response.status === 401) {
                    errorMsg = 'Sesi Anda telah berakhir atau belum masuk. Silakan login terlebih dahulu.';
                } else if (response.status === 404) {
                    errorMsg = 'Data tidak ditemukan.';
                } else if (response.status >= 500) {
                    errorMsg = 'Terjadi kesalahan pada server backend.';
                } else {
                    errorMsg = `Terjadi kesalahan (${response.status}).`;
                }
            }

            // Auto logout if unauthorized
            if (response.status === 401 || response.status === 422) {
                logout(false);
            }

            throw new Error(errorMsg);
        }
        return data;
    } catch (error) {
        showToast(error.message, true);
        if (
            error.message.includes('Token has expired') ||
            error.message.includes('Missing Authorization') ||
            error.message.includes('Sesi Anda telah berakhir')
        ) {
            logout(false);
        }
        throw error;
    }
}

// --- AUTHENTICATION STATE & GOOGLE GIS ---
let currentGoogleAuthIntent = 'login'; // 'login' or 'register'

function updatePasswordStrength(password) {
    const fillEl = document.getElementById('strength-bar-fill');
    const badgeEl = document.getElementById('strength-badge');
    if (!fillEl || !badgeEl) return;

    if (!password) {
        fillEl.style.width = '0%';
        fillEl.style.backgroundColor = 'transparent';
        badgeEl.className = 'strength-badge';
        badgeEl.textContent = 'Minimal 6 karakter';
        return;
    }

    if (password.length < 6) {
        fillEl.style.width = '25%';
        fillEl.style.backgroundColor = '#ef4444';
        badgeEl.className = 'strength-badge weak';
        badgeEl.textContent = 'Terlalu Pendek (< 6)';
        return;
    }

    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) {
        fillEl.style.width = '35%';
        fillEl.style.backgroundColor = '#ef4444';
        badgeEl.className = 'strength-badge weak';
        badgeEl.textContent = 'Lemah';
    } else if (score <= 4) {
        fillEl.style.width = '70%';
        fillEl.style.backgroundColor = '#f59e0b';
        badgeEl.className = 'strength-badge medium';
        badgeEl.textContent = 'Sedang';
    } else {
        fillEl.style.width = '100%';
        fillEl.style.backgroundColor = '#10b981';
        badgeEl.className = 'strength-badge strong';
        badgeEl.textContent = 'Sangat Kuat';
    }
}

function resetPasswordStrength() {
    updatePasswordStrength('');
}

function setButtonLoading(btn, isLoading, loadingText = '') {
    if (!btn) return;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    if (isLoading) {
        btn.disabled = true;
        if (btnText) {
            btn.dataset.originalText = btnText.textContent;
            if (loadingText) btnText.textContent = loadingText;
        }
        if (spinner) spinner.classList.remove('hidden');
    } else {
        btn.disabled = false;
        if (btnText && btn.dataset.originalText) {
            btnText.textContent = btn.dataset.originalText;
        }
        if (spinner) spinner.classList.add('hidden');
    }
}

function switchAuthTab(targetFormId, prefillEmail = '') {
    clearAuthAlert();
    resetPasswordStrength();
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.target === targetFormId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.auth-form').forEach(f => {
        f.classList.add('hidden');
        f.classList.remove('shake');
    });

    const targetForm = document.getElementById(targetFormId);
    if (targetForm) {
        targetForm.classList.remove('hidden');
    }

    if (targetFormId === 'register-form') {
        currentGoogleAuthIntent = 'register';
        if (prefillEmail) {
            const regEmailInput = document.getElementById('reg-email');
            if (regEmailInput) regEmailInput.value = prefillEmail;
        }
        renderGoogleRegisterButton();
    } else {
        currentGoogleAuthIntent = 'login';
        if (prefillEmail) {
            const loginEmailInput = document.getElementById('login-email');
            if (loginEmailInput) loginEmailInput.value = prefillEmail;
        }
        renderGoogleLoginButton();
    }
}

function renderGoogleLoginButton() {
    const el = document.getElementById('login-google-btn');
    if (!el || !window.google?.accounts?.id) return;
    try {
        google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
            click_listener: () => {
                currentGoogleAuthIntent = 'login';
            }
        });
    } catch (e) {
        console.warn('Google GIS login render note:', e);
    }
}

function renderGoogleRegisterButton() {
    const el = document.getElementById('register-google-btn');
    if (!el || !window.google?.accounts?.id) return;
    try {
        google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signup_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
            click_listener: () => {
                currentGoogleAuthIntent = 'register';
            }
        });
    } catch (e) {
        console.warn('Google GIS register render note:', e);
    }
}

function initGoogleAuth() {
    if (!window.google?.accounts?.id) {
        setTimeout(initGoogleAuth, 250);
        return;
    }
    const clientId = '740584970640-kr0kd1lgsio5kj9f5t0m7brat43n12v7.apps.googleusercontent.com';
    try {
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        renderGoogleLoginButton();
        renderGoogleRegisterButton();
    } catch (e) {
        console.warn('Google Identity Services initialization:', e);
    }
}

// --- AUTHENTICATION LOGIC ---
async function handleAuth(url, body, isRegister = false) {
    clearAuthAlert();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        let data = {};
        try {
            data = await response.json();
        } catch (jsonErr) {
            data = {};
        }

        if (!response.ok) {
            const errorMsg = data.message || (isRegister ? 'Registrasi gagal. Silakan periksa formulir pendaftaran.' : 'Email atau password yang Anda masukkan salah. Silakan periksa kembali!');
            
            // BR-01: User belum terdaftar saat mencoba Login (404)
            if (!isRegister && response.status === 404) {
                const typedEmail = body.email || '';
                showAuthAlert(
                    `${safeEscape(errorMsg)} <br/><button type="button" class="auth-inline-link" onclick="switchAuthTab('register-form', '${safeEscape(typedEmail)}')">Daftar Akun Baru Sekarang &rarr;</button>`,
                    true
                );
            }
            // BR-07: Email sudah terdaftar saat Sign Up (409)
            else if (isRegister && response.status === 409) {
                const typedEmail = body.email || '';
                showAuthAlert(
                    `${safeEscape(errorMsg)} <br/><button type="button" class="auth-inline-link" onclick="switchAuthTab('login-form', '${safeEscape(typedEmail)}')">Beralih ke Halaman Log In &rarr;</button>`,
                    true
                );
            } else {
                showAuthAlert(safeEscape(errorMsg), true);
            }
            showToast(errorMsg, true);
            return;
        }

        if (isRegister) {
            showAuthAlert('Registrasi berhasil! Silakan masuk dengan akun Anda.', false);
            showToast('Registrasi berhasil! Silakan masuk.');

            const registeredEmail = body.email || '';
            // Reset seluruh input pendaftaran dan ikon mata kembali ke awal
            registerForm.reset();
            resetPasswordStrength();
            const regPwToggle = registerForm.querySelector('.password-toggle-btn');
            if (regPwToggle) {
                regPwToggle.classList.remove('visible');
                regPwToggle.title = 'Lihat Password';
                regPwToggle.setAttribute('aria-label', 'Lihat kata sandi');
            }
            const regPwInput = document.getElementById('reg-password');
            if (regPwInput) regPwInput.type = 'password';

            setTimeout(() => {
                switchAuthTab('login-form', registeredEmail);
            }, 1200);
        } else {
            clearAuthAlert();
            loginSuccess(data);
        }
    } catch (e) {
        console.error('Auth error:', e);
        const netErrorMsg = 'Gagal terhubung ke server backend. Pastikan server Flask aktif.';
        showAuthAlert(netErrorMsg, true);
        showToast(netErrorMsg, true);
    }
}

async function handleGoogleCallback(response) {
    clearAuthAlert();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset?.target;
    const isRegister = (currentGoogleAuthIntent === 'register') || (activeTab === 'register-form');
    const endpoint = isRegister ? `${API_BASE}/auth/google/register` : `${API_BASE}/auth/google/login`;

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                credential: response.credential,
                action: isRegister ? 'register' : 'login'
            })
        });

        let data = {};
        try {
            data = await res.json();
        } catch (jsonErr) {
            data = {};
        }

        if (!res.ok) {
            const errorMsg = data.message || (isRegister ? 'Pendaftaran dengan akun Google gagal.' : 'Gagal masuk menggunakan akun Google.');

            // BR-04: User belum terdaftar saat mencoba Login Google (404)
            if (res.status === 404) {
                showAuthAlert(
                    `${safeEscape(errorMsg)} <br/><button type="button" class="auth-inline-link" onclick="switchAuthTab('register-form')">Daftar Akun Baru Sekarang &rarr;</button>`,
                    true
                );
            }
            // BR-09: Akun Google sudah terdaftar saat mencoba Register Google (409)
            else if (res.status === 409) {
                showAuthAlert(
                    `${safeEscape(errorMsg)} <br/><button type="button" class="auth-inline-link" onclick="switchAuthTab('login-form')">Beralih ke Halaman Log In &rarr;</button>`,
                    true
                );
            } else {
                showAuthAlert(safeEscape(errorMsg), true);
            }
            showToast(errorMsg, true);
            return;
        }

        if (isRegister) {
            showToast('Pendaftaran akun Google berhasil! Selamat datang.');
        }
        loginSuccess(data);
    } catch (e) {
        console.error('Google Auth Failed:', e);
        const errorMsg = 'Gagal memproses autentikasi Google. Silakan periksa koneksi Anda.';
        showAuthAlert(errorMsg, true);
        showToast(errorMsg, true);
    }
}

function loginSuccess(data) {
    currentToken = data.token;
    localStorage.setItem('token', currentToken);
    currentUser = data.user;
    updateUserProfile();
    loadCategoriesForCurrentUser();
    loadNotesForCurrentUser();
    switchMainView('app-view');
    switchTab('todo-view');
    fetchTasks();
    showToast(`Welcome back, ${currentUser.full_name}!`);
}

async function fetchMe() {
    try {
        const data = await apiFetch(`${API_BASE}/auth/me`);
        currentUser = data;
        updateUserProfile();
        loadCategoriesForCurrentUser();
        loadNotesForCurrentUser();
        switchMainView('app-view');
        fetchTasks();
    } catch (e) {
        logout();
    }
}

function logout(showMessage = true) {
    localStorage.removeItem('token');
    currentToken = null;
    currentUser = null;
    tasks = [];
    notesList = [];
    activeNoteId = null;
    customCategories = ['Project', 'Personal Project'];
    renderNotesList();
    showEmptyNotesEditor();
    switchMainView('auth-view');
    if (showMessage) {
        showToast('Anda telah keluar.');
    }
}

function updateUserProfile() {
    if (!currentUser) return;
    document.getElementById('user-name').textContent = currentUser.full_name;
    const avatarEl = document.getElementById('user-avatar');
    if (currentUser.avatar_url) {
        avatarEl.src = currentUser.avatar_url;
    } else {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}&background=3b82f6&color=fff`;
    }
}

// --- TASK MANAGEMENT (CRUD) ---
async function fetchTasks() {
    try {
        const data = await apiFetch(`${API_BASE}/tasks`);
        tasks = data.tasks || [];
        updateSidebarCounts();
        renderTasks();
        if (currentView === 'calendar-view') renderCalendar();
        if (currentView === 'project-view') renderProjects();
    } catch (e) {
        console.error('Failed to fetch tasks:', e);
    }
}

async function saveTask(taskData, taskId = null) {
    if (!currentToken) {
        showToast('Silakan login terlebih dahulu untuk menyimpan tugas.', true);
        logout(false);
        return;
    }
    try {
        if (taskId) {
            // Update
            const data = await apiFetch(`${API_BASE}/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify(taskData)
            });
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx !== -1) tasks[idx] = data.task;
            showToast('Tugas berhasil diperbarui!');
        } else {
            // Create
            const data = await apiFetch(`${API_BASE}/tasks`, {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
            tasks.unshift(data.task);
            showToast('Tugas berhasil ditambahkan!');
        }
        closeModal();
        updateSidebarCounts();
        renderTasks();
        if (currentView === 'calendar-view') renderCalendar();
        if (selectedTimelineDate) renderDayTimeline();
        if (currentView === 'project-view') renderProjects();
    } catch (e) {
        console.error('Failed to save task:', e);
    }
}

async function toggleTaskStatus(id, newStatus = null) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let targetStatus = newStatus;
    if (!targetStatus) {
        // Cycle: todo -> in_progress -> completed -> todo
        if (task.status === 'todo') targetStatus = 'in_progress';
        else if (task.status === 'in_progress') targetStatus = 'completed';
        else targetStatus = 'todo';
    }

    const is_completed = (targetStatus === 'completed');
    try {
        const data = await apiFetch(`${API_BASE}/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: targetStatus, is_completed })
        });
        const idx = tasks.findIndex(t => t.id === id);
        if (idx !== -1) tasks[idx] = data.task;
        updateSidebarCounts();
        renderTasks();
        if (currentView === 'calendar-view') renderCalendar();
        if (selectedTimelineDate) renderDayTimeline();
        if (currentView === 'project-view') renderProjects();
    } catch (e) {
        console.error('Failed to toggle status:', e);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        await apiFetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
        tasks = tasks.filter(t => t.id !== id);
        updateSidebarCounts();
        renderTasks();
        if (currentView === 'calendar-view') renderCalendar();
        if (selectedTimelineDate) renderDayTimeline();
        if (currentView === 'project-view') renderProjects();
        showToast('Task deleted');
    } catch (e) {
        console.error('Failed to delete task:', e);
    }
}

// ==========================================================================
// FEATURE 3: CONFETTI CELEBRATION (PURE JAVASCRIPT CANVAS)
// ==========================================================================
function launchConfetti(originX, originY) {
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    const particles = [];
    const count = 40;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        particles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2.5,
            size: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            vRot: (Math.random() - 0.5) * 12,
            opacity: 1,
            gravity: 0.2
        });
    }

    let animId;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rotation += p.vRot;
            p.opacity -= 0.02;

            if (p.opacity > 0) {
                alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
                ctx.restore();
            }
        });

        if (alive) {
            animId = requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cancelAnimationFrame(animId);
        }
    }
    render();
}

// ==========================================================================
// FEATURE 2: SMART DUE DATE FORMATTER
// ==========================================================================
function formatSmartDate(dateStr, isCompleted = false) {
    if (!dateStr) return { text: '-', className: '' };

    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dTime = d.getTime();
    const todayTime = today.getTime();
    const tomorrowTime = tomorrow.getTime();

    if (dTime === todayTime) {
        return { text: '🔥 Hari Ini', className: 'today' };
    } else if (dTime === tomorrowTime) {
        return { text: '⏰ Besok', className: 'tomorrow' };
    } else if (dTime < todayTime && !isCompleted) {
        return { text: '⚠️ Terlambat', className: 'overdue' };
    } else {
        const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        return { text: `📅 ${formatted}`, className: '' };
    }
}

// ==========================================================================
// FEATURE 4: STATUS POPOVER DROPDOWN MENU
// ==========================================================================
function openStatusPopover(event, taskId) {
    event.stopPropagation();
    // Tutup popover lain yang sedang terbuka
    document.querySelectorAll('.status-popover').forEach(p => p.remove());

    const badge = event.currentTarget;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const popover = document.createElement('div');
    popover.className = 'status-popover';

    const statuses = [
        { key: 'todo', label: '⚪ New task' },
        { key: 'in_progress', label: '🟡 In Progress' },
        { key: 'completed', label: '🟢 Completed' }
    ];

    statuses.forEach(s => {
        const item = document.createElement('div');
        item.className = `status-popover-item ${task.status === s.key ? 'active' : ''}`;
        item.textContent = s.label;
        item.onclick = async (e) => {
            e.stopPropagation();
            popover.remove();
            if (s.key === 'completed' && task.status !== 'completed') {
                const rect = badge.getBoundingClientRect();
                launchConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
            await toggleTaskStatus(taskId, s.key);
        };
        popover.appendChild(item);
    });

    badge.parentElement.appendChild(popover);

    // Tutup jika klik di luar
    const closeListener = (e) => {
        if (!popover.contains(e.target)) {
            popover.remove();
            document.removeEventListener('click', closeListener);
        }
    };
    setTimeout(() => document.addEventListener('click', closeListener), 10);
}

// ==========================================================================
// FEATURE 3: SMOOTH COMPLETION TRANSITION
// ==========================================================================
async function handleCheckboxToggle(event, taskId, willComplete) {
    const checkbox = event.currentTarget;
    const row = checkbox.closest('.table-row-item');

    if (willComplete) {
        const rect = checkbox.getBoundingClientRect();
        launchConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (row) {
            row.classList.add('task-completing');
            const titleEl = row.querySelector('.task-title-text');
            if (titleEl) titleEl.style.textDecoration = 'line-through';
        }
        setTimeout(async () => {
            await toggleTaskStatus(taskId, 'completed');
        }, 320);
    } else {
        await toggleTaskStatus(taskId, 'todo');
    }
}

// ==========================================================================
// FEATURE 5: INLINE QUICK-ADD ROW
// ==========================================================================
function createInlineQuickAddRow() {
    const row = document.createElement('div');
    row.className = 'inline-quick-add';
    row.id = 'inline-quick-add-row';

    row.innerHTML = `
        <div class="inline-add-icon">+</div>
        <div class="inline-add-trigger">New task...</div>
    `;

    row.onclick = () => {
        row.innerHTML = `
            <div class="inline-add-icon" style="color: var(--primary);">●</div>
            <div class="inline-add-form">
                <input type="text" id="inline-task-title" class="inline-add-input" placeholder="Tulis judul tugas dan tekan Enter..." autocomplete="off">
                <span class="inline-add-hint">Press Enter ↵</span>
            </div>
        `;
        const input = row.querySelector('#inline-task-title');
        input.focus();

        input.onkeydown = async (e) => {
            if (e.key === 'Enter') {
                const title = input.value.trim();
                if (title) {
                    await saveTask({
                        title: title,
                        category: currentCategoryFilter !== 'all' ? currentCategoryFilter : 'Project',
                        status: 'todo',
                        due_date: new Date().toISOString().split('T')[0]
                    });
                } else {
                    renderTasks();
                }
            } else if (e.key === 'Escape') {
                renderTasks();
            }
        };

        input.onblur = () => {
            setTimeout(() => {
                if (document.getElementById('inline-task-title') && !document.getElementById('inline-task-title').value.trim()) {
                    renderTasks();
                }
            }, 180);
        };
    };

    return row;
}

// --- RENDER 1: MODERN TABLE / TO-DO LIST ---
function renderTasks() {
    const activeRowsContainer = document.getElementById('active-tasks-rows');
    const completedRowsContainer = document.getElementById('completed-tasks-rows');
    activeRowsContainer.innerHTML = '';
    completedRowsContainer.innerHTML = '';

    // Filter tasks
    const filtered = tasks.filter(task => {
        // Category filter
        if (currentCategoryFilter !== 'all' && task.category !== currentCategoryFilter) {
            return false;
        }
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchTitle = task.title.toLowerCase().includes(q);
            const matchDesc = task.description && task.description.toLowerCase().includes(q);
            if (!matchTitle && !matchDesc) return false;
        }
        return true;
    });

    const activeTasks = filtered.filter(t => !t.is_completed && t.status !== 'completed');
    const completedTasks = filtered.filter(t => t.is_completed || t.status === 'completed');

    // Update counters
    document.getElementById('active-tasks-badge').textContent = activeTasks.length;
    document.getElementById('completed-tasks-badge').textContent = completedTasks.length;
    document.getElementById('current-task-count').textContent = `${filtered.length} tasks`;
    document.getElementById('current-view-title').textContent =
        currentCategoryFilter === 'all' ? 'All Tasks' : currentCategoryFilter;

    // Render Active Tasks
    if (activeTasks.length === 0) {
        activeRowsContainer.innerHTML = `<div class="empty-state-card">Belum ada tugas aktif di daftar ini.</div>`;
    } else {
        activeTasks.forEach(task => {
            activeRowsContainer.appendChild(createTableRow(task));
        });
    }

    // FEATURE 5: Selalu tempelkan baris Quick Add di bawah active tasks
    activeRowsContainer.appendChild(createInlineQuickAddRow());

    // Render Completed Tasks
    if (completedTasks.length === 0) {
        completedRowsContainer.innerHTML = `<div class="empty-state-card">Belum ada tugas yang selesai.</div>`;
    } else {
        completedTasks.forEach(task => {
            completedRowsContainer.appendChild(createTableRow(task, true));
        });
    }

    const activeTableEl = document.getElementById('active-tasks-table');
    const completedTableEl = document.getElementById('completed-tasks-table');
    if (activeTableEl && !activeTableEl.classList.contains('collapsed')) {
        activeTableEl.style.maxHeight = 'none';
    }
    if (completedTableEl && !completedTableEl.classList.contains('collapsed')) {
        completedTableEl.style.maxHeight = 'none';
    }

    // Update Productivity Statistics & Insights
    if (typeof renderProductivityStats === 'function') {
        renderProductivityStats();
    }
}

function createTableRow(task, isCompleted = false) {
    const row = document.createElement('div');
    row.className = `table-row-item ${isCompleted ? 'completed-item' : ''}`;

    // Format Status Badge
    let statusLabel = 'New task';
    let statusClass = 'status-todo';
    if (task.status === 'in_progress') {
        statusLabel = 'In Progress';
        statusClass = 'status-in_progress';
    } else if (task.status === 'completed' || isCompleted) {
        statusLabel = 'Completed';
        statusClass = 'status-completed';
    }

    // FEATURE 2: Smart Due Date
    const smartDate = formatSmartDate(task.due_date, isCompleted);

    // FEATURE 2: Kategori dengan warna berbeda
    let catClass = 'cat-project';
    if (task.category === 'Personal Project') catClass = 'cat-personal';
    else if (task.category && task.category !== 'Project') catClass = 'cat-custom';

    row.innerHTML = `
        <div class="col-check">
            <input type="checkbox" class="task-checkbox-custom" ${isCompleted ? 'checked' : ''} 
                   onchange="handleCheckboxToggle(event, ${task.id}, this.checked)">
        </div>
        <div class="col-title">
            <div class="task-title-text">${escapeHTML(task.title)}</div>
            ${task.description ? `<div class="task-desc-text">${escapeHTML(task.description)}</div>` : ''}
        </div>
        <div class="col-status">
            <div class="status-badge-wrapper">
                <span class="status-badge ${statusClass}" title="Klik untuk ubah status" onclick="openStatusPopover(event, ${task.id})">
                    ● ${statusLabel}
                </span>
            </div>
        </div>
        <div class="col-cat">
            <span class="category-badge ${catClass}" title="${escapeHTML(task.category || 'Project')}">
                ${escapeHTML(task.category || 'Project')}
            </span>
        </div>
        <div class="col-date">
            <span class="date-display ${smartDate.className}">
                ${smartDate.text}
            </span>
        </div>
        <div class="col-actions">
            <button class="row-action-btn edit-btn" title="Edit task" onclick="openEditModal(${task.id})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="row-action-btn delete-btn" title="Delete task" onclick="deleteTask(${task.id})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    `;
    return row;
}

// ==========================================================================
// CALENDAR VIEW ENHANCEMENTS (POINTS 1, 2, 3)
// ==========================================================================

// Point 1: Category Color System
const CATEGORY_COLORS = {
    'Project': '#2563eb',
    'Personal Project': '#7c3aed',
    'Kerjaan': '#0284c7',
    'Kuliah': '#059669',
    'Skripsi': '#d97706',
    'Personal': '#7c3aed'
};

const DYNAMIC_CATEGORY_PALETTE = [
    '#2563eb', // Blue
    '#7c3aed', // Purple
    '#059669', // Emerald
    '#d97706', // Amber
    '#e11d48', // Rose
    '#0891b2', // Cyan
    '#8b5cf6', // Violet
    '#ea580c', // Orange
    '#4f46e5'  // Indigo
];

function getCategoryColor(category) {
    if (!category) return '#2563eb';
    if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % DYNAMIC_CATEGORY_PALETTE.length;
    return DYNAMIC_CATEGORY_PALETTE[index];
}

// Point 2: Interactive Floating Hover Preview Card Logic
let calHoverTimeout = null;
const calHoverCard = document.getElementById('cal-hover-card');

if (calHoverCard) {
    calHoverCard.addEventListener('mouseenter', () => {
        clearTimeout(calHoverTimeout);
    });
    calHoverCard.addEventListener('mouseleave', () => {
        calHoverTimeout = setTimeout(() => {
            calHoverCard.classList.add('hidden');
        }, 220);
    });
}

function hideCalHoverCardWithDelay() {
    clearTimeout(calHoverTimeout);
    calHoverTimeout = setTimeout(() => {
        if (calHoverCard) calHoverCard.classList.add('hidden');
    }, 220);
}

function showCalHoverCard(task, pillEl, catColor) {
    if (!calHoverCard) return;
    clearTimeout(calHoverTimeout);

    // Format Date
    let dateLabel = task.due_date;
    try {
        const d = new Date(task.due_date + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            dateLabel = d.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
    } catch (_) { }

    const isCompleted = task.is_completed || task.status === 'completed';
    let statusLabel = '● To-Do';
    let statusBg = '#f1f5f9';
    let statusColor = '#475569';

    if (task.status === 'in_progress') {
        statusLabel = '🟡 In Progress';
        statusBg = '#fef3c7';
        statusColor = '#92400e';
    } else if (isCompleted) {
        statusLabel = '🟢 Completed';
        statusBg = '#d1fae5';
        statusColor = '#065f46';
    }

    const catName = task.category || 'Project';

    calHoverCard.innerHTML = `
        <div class="cal-hover-header">
            <div class="cal-hover-badges">
                <span class="cal-hover-cat-badge" style="background-color: ${catColor}18; color: ${catColor}; border: 1px solid ${catColor}40;">
                    <span class="cal-cat-dot" style="background-color: ${catColor};"></span>
                    ${escapeHTML(catName)}
                </span>
                <span class="cal-hover-status-badge" style="background-color: ${statusBg}; color: ${statusColor};">
                    ${statusLabel}
                </span>
            </div>
            <h4 class="cal-hover-title" style="${isCompleted ? 'text-decoration: line-through; opacity: 0.75;' : ''}">
                ${escapeHTML(task.title)}
            </h4>
        </div>
        ${task.description
            ? `<div class="cal-hover-desc">${escapeHTML(task.description)}</div>`
            : `<div class="cal-hover-desc empty">Tidak ada catatan tambahan</div>`}
        <div class="cal-hover-meta">
            <span>📅 Tenggat: <strong>${dateLabel}</strong></span>
        </div>
        <div class="cal-hover-actions">
            ${isCompleted
            ? `<button class="cal-hover-action-btn cal-hover-btn-reopen" id="cal-hover-action-toggle">
                     ↺ Aktifkan Kembali
                   </button>`
            : `<button class="cal-hover-action-btn cal-hover-btn-complete" id="cal-hover-action-toggle">
                     ✓ Tandai Selesai
                   </button>`}
            <button class="cal-hover-action-btn cal-hover-btn-edit" id="cal-hover-action-edit">
                ✎ Detail
            </button>
        </div>
    `;

    // Hook quick complete / reopen button
    const toggleBtn = calHoverCard.querySelector('#cal-hover-action-toggle');
    if (toggleBtn) {
        toggleBtn.onclick = async (e) => {
            e.stopPropagation();
            calHoverCard.classList.add('hidden');
            if (!isCompleted) {
                const rect = pillEl.getBoundingClientRect();
                launchConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
                await toggleTaskStatus(task.id, 'completed');
            } else {
                await toggleTaskStatus(task.id, 'todo');
            }
        };
    }

    // Hook edit button
    const editBtn = calHoverCard.querySelector('#cal-hover-action-edit');
    if (editBtn) {
        editBtn.onclick = (e) => {
            e.stopPropagation();
            calHoverCard.classList.add('hidden');
            openEditModal(task.id);
        };
    }

    // Positioning calculations
    const rect = pillEl.getBoundingClientRect();
    const cardWidth = 290;
    const cardHeight = 190;

    let left = rect.left;
    if (left + cardWidth > window.innerWidth - 14) {
        left = window.innerWidth - cardWidth - 16;
    }
    if (left < 14) left = 14;

    let top = rect.bottom + 8;
    if (top + cardHeight > window.innerHeight - 14) {
        top = Math.max(14, rect.top - cardHeight - 8);
    }

    calHoverCard.style.left = `${left}px`;
    calHoverCard.style.top = `${top}px`;
    calHoverCard.classList.remove('hidden');
}

// --- KATEGORI 2: DRAG AND DROP RESCHEDULE & UTILS ---
function handleCalTaskDragStart(e, task) {
    draggedTaskId = task.id;
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('is-dragging');
    if (calHoverCard) calHoverCard.classList.add('hidden');
}

function handleCalTaskDragEnd(e) {
    e.currentTarget.classList.remove('is-dragging');
    document.querySelectorAll('.calendar-day-cell.drag-target-hover').forEach(cell => {
        cell.classList.remove('drag-target-hover');
    });
}

function handleCellDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleCellDragEnter(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-target-hover');
}

function handleCellDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-target-hover');
    }
}

async function handleCellDrop(e, targetDateStr) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-target-hover');

    const taskIdStr = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr, 10);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.due_date === targetDateStr) {
        return; // Dropped on same date
    }

    const oldDate = task.due_date;
    // Optimistic update
    task.due_date = targetDateStr;
    renderCalendar();
    if (selectedTimelineDate) {
        renderDayTimeline();
    }

    try {
        const res = await apiFetch(`${API_BASE}/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({ due_date: targetDateStr })
        });
        if (res && res.task) {
            const idx = tasks.findIndex(t => t.id === taskId);
            if (idx !== -1) tasks[idx] = res.task;
        }
        showToast(`📅 Jadwal tugas "${task.title}" dipindahkan ke ${formatDateIndo(targetDateStr)}!`);
    } catch (err) {
        // Revert optimistic update
        task.due_date = oldDate;
        renderCalendar();
        if (selectedTimelineDate) {
            renderDayTimeline();
        }
        showToast(`Gagal memindahkan tugas: ${err.message}`, true);
    }
}

function formatDateIndo(dateStr) {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
    } catch (_) { }
    return dateStr;
}

// --- RENDER 2: CALENDAR VIEW ---
function renderCalendar() {
    const monthYearEl = document.getElementById('calendar-month-year');
    const gridEl = document.getElementById('calendar-days-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    // Synchronize Project Filter Dropdown in Calendar Controls
    const filterSelect = document.getElementById('cal-project-filter');
    if (filterSelect) {
        const currentVal = calendarCategoryFilter;
        const allCats = getAllCategories();
        filterSelect.innerHTML = `<option value="all">Semua Proyek</option>`;
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === currentVal) opt.selected = true;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = currentVal;
    }

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    monthYearEl.textContent = `${monthNames[month]} ${year}`;

    // First day of current month & total days
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Previous month filler days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const cellIndex = gridEl.children.length;
        const col = cellIndex % 7;
        const isWeekend = (col === 0 || col === 6);
        const dayNum = prevMonthDays - i;

        const pDate = new Date(year, month - 1, dayNum);
        const pDateStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;

        const cell = document.createElement('div');
        cell.className = `calendar-day-cell other-month ${isWeekend ? 'is-weekend' : ''}`;
        cell.innerHTML = `<div class="cell-header-row"><span class="day-number">${dayNum}</span></div>`;

        cell.addEventListener('dragover', handleCellDragOver);
        cell.addEventListener('dragenter', handleCellDragEnter);
        cell.addEventListener('dragleave', handleCellDragLeave);
        cell.addEventListener('drop', (e) => handleCellDrop(e, pDateStr));
        cell.onclick = () => openDayTimeline(pDateStr);

        gridEl.appendChild(cell);
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const cellIndex = gridEl.children.length;
        const col = cellIndex % 7;
        const isWeekend = (col === 0 || col === 6);

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isSelected = (selectedTimelineDate === dateStr);

        const cell = document.createElement('div');
        cell.className = `calendar-day-cell ${isWeekend ? 'is-weekend' : ''} ${isSelected ? 'is-selected' : ''}`;
        if (isCurrentMonth && today.getDate() === day) {
            cell.classList.add('is-today');
        }

        // Header row with day number and Mini Daily Progress Indicator
        const headerRow = document.createElement('div');
        headerRow.className = 'cell-header-row';

        const dayNumSpan = document.createElement('span');
        dayNumSpan.className = 'day-number';
        dayNumSpan.textContent = day;
        headerRow.appendChild(dayNumSpan);

        // Filter tasks for this day (by date & project filter)
        const rawDayTasks = tasks.filter(t => t.due_date === dateStr);
        const dayTasks = calendarCategoryFilter === 'all'
            ? rawDayTasks
            : rawDayTasks.filter(t => (t.category || 'Project') === calendarCategoryFilter);

        // Kategori 2: Mini Daily Progress Indicator
        if (dayTasks.length > 0) {
            const completedCount = dayTasks.filter(t => t.is_completed || t.status === 'completed').length;
            const totalCount = dayTasks.length;
            const allDone = completedCount === totalCount;

            const badge = document.createElement('span');
            badge.className = `day-progress-badge ${allDone ? 'all-done' : ''}`;
            badge.title = `${completedCount} dari ${totalCount} tugas selesai`;
            badge.innerHTML = allDone
                ? `✓ ${completedCount}/${totalCount}`
                : `${completedCount}/${totalCount}`;
            headerRow.appendChild(badge);
        }
        cell.appendChild(headerRow);

        // Render task pills
        dayTasks.forEach(task => {
            const pill = document.createElement('div');
            let pillClass = 'status-todo';
            if (task.status === 'in_progress') pillClass = 'status-in_progress';
            if (task.status === 'completed' || task.is_completed) pillClass = 'status-completed';

            const catColor = getCategoryColor(task.category);

            pill.className = `cal-task-pill ${pillClass}`;
            pill.setAttribute('draggable', 'true');
            pill.innerHTML = `
                <span class="cal-cat-dot" style="background-color: ${catColor};"></span>
                <span class="cal-pill-title">${escapeHTML(task.title)}</span>
            `;

            // Drag and drop events for pill
            pill.addEventListener('dragstart', (e) => handleCalTaskDragStart(e, task));
            pill.addEventListener('dragend', handleCalTaskDragEnd);

            // Hover preview card
            pill.addEventListener('mouseenter', () => {
                showCalHoverCard(task, pill, catColor);
            });
            pill.addEventListener('mouseleave', () => {
                hideCalHoverCardWithDelay();
            });

            // Click opens edit modal
            pill.onclick = (e) => {
                e.stopPropagation();
                if (calHoverCard) calHoverCard.classList.add('hidden');
                openEditModal(task.id);
            };

            cell.appendChild(pill);
        });

        // Drop zone events for day cell
        cell.addEventListener('dragover', handleCellDragOver);
        cell.addEventListener('dragenter', handleCellDragEnter);
        cell.addEventListener('dragleave', handleCellDragLeave);
        cell.addEventListener('drop', (e) => handleCellDrop(e, dateStr));

        // Clicking day cell selects date and opens Day Timeline Side-Bar
        cell.onclick = () => {
            openDayTimeline(dateStr);
        };

        gridEl.appendChild(cell);
    }

    // Next month filler days to complete grid (multiples of 7)
    const currentCells = firstDayIndex + totalDays;
    const remaining = (7 - (currentCells % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
        const cellIndex = gridEl.children.length;
        const col = cellIndex % 7;
        const isWeekend = (col === 0 || col === 6);

        const nDate = new Date(year, month + 1, j);
        const nDateStr = `${nDate.getFullYear()}-${String(nDate.getMonth() + 1).padStart(2, '0')}-${String(nDate.getDate()).padStart(2, '0')}`;

        const cell = document.createElement('div');
        cell.className = `calendar-day-cell other-month ${isWeekend ? 'is-weekend' : ''}`;
        cell.innerHTML = `<div class="cell-header-row"><span class="day-number">${j}</span></div>`;

        cell.addEventListener('dragover', handleCellDragOver);
        cell.addEventListener('dragenter', handleCellDragEnter);
        cell.addEventListener('dragleave', handleCellDragLeave);
        cell.addEventListener('drop', (e) => handleCellDrop(e, nDateStr));
        cell.onclick = () => openDayTimeline(nDateStr);

        gridEl.appendChild(cell);
    }
}

// ==========================================================================
// DAY TIMELINE SIDE-BAR & REAL-TIME RED LINE INDICATOR (REFERENSI GAMBAR)
// ==========================================================================
let selectedTimelineDate = null;
let liveTimeInterval = null;
const TIMELINE_START_HOUR = 1; // 01:00 (Paling atas)
const TIMELINE_END_HOUR = 23;  // 23:00 (Paling bawah)
const HOUR_ROW_HEIGHT = 52;    // Height matching CSS .timeline-hour-row

function openDayTimeline(dateStr) {
    selectedTimelineDate = dateStr;
    const panel = document.getElementById('day-timeline-panel');
    const backdrop = document.getElementById('timeline-backdrop');
    if (panel) {
        panel.classList.remove('hidden');
    }
    if (backdrop && window.innerWidth <= 1024) {
        backdrop.classList.remove('hidden');
    }
    renderCalendar();
    renderDayTimeline();
}

function closeDayTimeline() {
    selectedTimelineDate = null;
    const panel = document.getElementById('day-timeline-panel');
    const backdrop = document.getElementById('timeline-backdrop');
    if (panel) {
        panel.classList.add('hidden');
    }
    if (backdrop) {
        backdrop.classList.add('hidden');
    }
    if (liveTimeInterval) {
        clearInterval(liveTimeInterval);
        liveTimeInterval = null;
    }
    renderCalendar();
}

function updateLiveRedLine(autoScroll = false) {
    const redLine = document.getElementById('timeline-current-time-line');
    const timeLabel = document.getElementById('current-time-label');
    if (!redLine || !timeLabel || !selectedTimelineDate) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (selectedTimelineDate !== todayStr) {
        redLine.classList.add('hidden');
        return;
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Format jam menit rapi: 01.48 (sesuai format Indonesia 24 jam)
    const displayHours = String(hours).padStart(2, '0');
    const displayMinutes = String(minutes).padStart(2, '0');
    timeLabel.textContent = `${displayHours}.${displayMinutes}`;

    // Vertical top position relative to timeline container (mulai dari 01.00)
    const hourOffset = (hours < TIMELINE_START_HOUR)
        ? 0
        : (hours - TIMELINE_START_HOUR + minutes / 60);
    const topPx = Math.max(0, hourOffset * HOUR_ROW_HEIGHT + 10);

    redLine.style.top = `${topPx}px`;
    redLine.classList.remove('hidden');

    if (autoScroll) {
        const scrollContainer = document.getElementById('timeline-hours-scroll');
        if (scrollContainer) {
            scrollContainer.scrollTop = Math.max(0, topPx - 100);
        }
    }
}

function renderDayTimeline() {
    if (!selectedTimelineDate) return;

    const panel = document.getElementById('day-timeline-panel');
    if (!panel) return;

    // 1. Day Title & Today badge
    const dayTitleEl = document.getElementById('timeline-day-title');
    const todayBadgeEl = document.getElementById('timeline-today-badge');

    let titleText = selectedTimelineDate;
    try {
        const d = new Date(selectedTimelineDate + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            titleText = d.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
    } catch (_) { }

    if (dayTitleEl) dayTitleEl.textContent = titleText;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = (selectedTimelineDate === todayStr);

    if (todayBadgeEl) {
        todayBadgeEl.classList.toggle('hidden', !isToday);
    }

    // 2. Filter tasks for selected date
    const rawDayTasks = tasks.filter(t => t.due_date === selectedTimelineDate);
    const dayTasks = calendarCategoryFilter === 'all'
        ? rawDayTasks
        : rawDayTasks.filter(t => (t.category || 'Project') === calendarCategoryFilter);
    const allDayTasks = dayTasks.filter(t => !t.due_time);
    const timedTasks = dayTasks.filter(t => !!t.due_time);

    // 3. Render All Day section
    const allDayCountEl = document.getElementById('all-day-count');
    const allDayListEl = document.getElementById('timeline-all-day-list');
    if (allDayCountEl) allDayCountEl.textContent = allDayTasks.length;

    if (allDayListEl) {
        allDayListEl.innerHTML = '';
        if (allDayTasks.length === 0) {
            allDayListEl.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; padding: 4px 0;">Tidak ada tugas all-day</div>`;
        } else {
            allDayTasks.forEach(task => {
                const isCompleted = task.is_completed || task.status === 'completed';
                const catColor = getCategoryColor(task.category);

                const chip = document.createElement('div');
                chip.className = `all-day-chip ${isCompleted ? 'completed' : ''}`;
                chip.innerHTML = `
                    <span class="cal-cat-dot" style="background-color: ${catColor};"></span>
                    <span class="all-day-chip-title">${escapeHTML(task.title)}</span>
                    <span style="font-size:0.6875rem; color:${isCompleted ? 'var(--success)' : 'var(--text-muted)'};">${isCompleted ? '✓' : '●'}</span>
                `;
                chip.onclick = (e) => {
                    e.stopPropagation();
                    openEditModal(task.id);
                };
                allDayListEl.appendChild(chip);
            });
        }
    }

    // 4. Render Hourly Rows in #timeline-hours-container
    const hoursContainer = document.getElementById('timeline-hours-container');
    if (hoursContainer) {
        const redLine = document.getElementById('timeline-current-time-line');
        hoursContainer.innerHTML = '';
        if (redLine) hoursContainer.appendChild(redLine);

        for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
            const row = document.createElement('div');
            row.className = 'timeline-hour-row';

            // Format jam 24 jam rapi e.g. 01.00, 02.00, ... 23.00
            const labelText = `${String(h).padStart(2, '0')}.00`;

            const labelEl = document.createElement('div');
            labelEl.className = 'timeline-hour-label';
            labelEl.textContent = labelText;

            const slotEl = document.createElement('div');
            slotEl.className = 'timeline-hour-slot';
            slotEl.dataset.hour = h;

            // Tasks scheduled in this hour
            const hourTasks = timedTasks.filter(t => {
                const hourNum = parseInt(t.due_time.split(':')[0], 10);
                return hourNum === h;
            });

            hourTasks.forEach(task => {
                const catColor = getCategoryColor(task.category);
                const isCompleted = task.is_completed || task.status === 'completed';

                const block = document.createElement('div');
                block.className = 'timeline-task-block';
                block.style.backgroundColor = `${catColor}14`;
                block.style.borderColor = `${catColor}40`;
                block.style.color = catColor;
                if (isCompleted) {
                    block.style.opacity = '0.6';
                    block.style.textDecoration = 'line-through';
                }

                block.innerHTML = `
                    <span class="cal-cat-dot" style="background-color: ${catColor};"></span>
                    <span class="timeline-task-time-badge">${task.due_time}</span>
                    <span class="timeline-task-title">${escapeHTML(task.title)}</span>
                `;

                block.onclick = (e) => {
                    e.stopPropagation();
                    openEditModal(task.id);
                };

                slotEl.appendChild(block);
            });

            // Clicking empty slot opens modal with selected date and this hour
            slotEl.onclick = (e) => {
                if (e.target.closest('.timeline-task-block')) return;
                const timeStr = `${String(h).padStart(2, '0')}:00`;
                openNewModalWithDate(selectedTimelineDate, timeStr);
            };

            row.appendChild(labelEl);
            row.appendChild(slotEl);
            hoursContainer.appendChild(row);
        }
    }

    // 5. Manage Real-Time Red Line
    if (isToday) {
        updateLiveRedLine(true);
        if (liveTimeInterval) clearInterval(liveTimeInterval);
        liveTimeInterval = setInterval(() => {
            updateLiveRedLine(false);
        }, 30000); // Live tracking every 30 seconds
    } else {
        const redLine = document.getElementById('timeline-current-time-line');
        if (redLine) redLine.classList.add('hidden');
        if (liveTimeInterval) {
            clearInterval(liveTimeInterval);
            liveTimeInterval = null;
        }
    }
}

// --- CATEGORY & PROJECT STATE (USER-ISOLATED) ---
let customCategories = ['Project', 'Personal Project'];

function getUserIdentifier() {
    if (currentUser) {
        return currentUser.id || currentUser.email || 'user';
    }
    return 'guest';
}

function getCategoriesStorageKey() {
    return `taskmaster_categories_${getUserIdentifier()}`;
}

function loadCategoriesForCurrentUser() {
    const key = getCategoriesStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            customCategories = JSON.parse(saved);
        } catch (_) {
            customCategories = ['Project', 'Personal Project'];
        }
    } else {
        customCategories = ['Project', 'Personal Project'];
    }
    updateSidebarCounts();
    updateNotesProjectSelects();
    updateTaskModalCategories();
}

function saveCategoriesToStorage() {
    try {
        localStorage.setItem(getCategoriesStorageKey(), JSON.stringify(customCategories));
    } catch (e) {
        console.error('Failed to save categories:', e);
    }
}

function getAllCategories() {
    const list = [...customCategories];
    if (!list.includes('Project')) list.unshift('Project');
    if (!list.includes('Personal Project')) list.splice(1, 0, 'Personal Project');
    tasks.forEach(t => {
        if (t.category && !list.includes(t.category)) {
            list.push(t.category);
        }
    });
    return list;
}

function addCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const all = getAllCategories();
    if (!all.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
        customCategories.push(trimmed);
        saveCategoriesToStorage();
    }
    updateSidebarCounts();
    renderProjects();
    updateTaskModalCategories();
    return true;
}

function updateTaskModalCategories() {
    const select = document.getElementById('modal-task-cat');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '';
    const all = getAllCategories();
    all.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
    if (all.includes(currentVal)) {
        select.value = currentVal;
    }
}

// --- RENDER 3: PROJECTS OVERVIEW ---
function renderProjects() {
    const gridEl = document.getElementById('projects-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const allCategories = getAllCategories();

    allCategories.forEach(cat => {
        const catTasks = tasks.filter(t => (t.category || 'Project') === cat);
        const completedCount = catTasks.filter(t => t.is_completed || t.status === 'completed').length;
        const total = catTasks.length;
        const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

        const catNotes = notesList.filter(n => (n.project || 'Project') === cat);
        const notesCount = catNotes.length;
        const catColor = getCategoryColor(cat);

        const card = document.createElement('div');
        card.className = 'project-card';
        const icon = cat === 'Personal Project' ? '📁' : (cat === 'Project' ? '💼' : '📂');

        card.innerHTML = `
            <div class="project-card-header">
                <div class="project-icon-box" style="background-color: ${catColor}18; color: ${catColor}; border-color: ${catColor}33;">
                    <span class="project-icon">${icon}</span>
                </div>
                <div class="project-header-text">
                    <h3 class="project-title" title="${escapeHTML(cat)}">${escapeHTML(cat)}</h3>
                    <span class="project-meta-tasks">${total} total tugas</span>
                </div>
                <div class="project-header-badge">
                    <span class="project-percent-badge ${percent === 100 ? 'complete' : ''}">${percent}%</span>
                </div>
            </div>
            <div class="project-progress-section">
                <div class="project-stats-row">
                    <span class="project-progress-label">Kemajuan Pengerjaan</span>
                    <span class="project-progress-count"><strong>${completedCount}</strong>/${total} selesai</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${percent === 100 ? '#10b981' : catColor};"></div>
                </div>
            </div>
            <div class="project-card-footer">
                <button type="button" class="project-notes-badge" title="Buka catatan untuk proyek ${escapeHTML(cat)}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <span>${notesCount} Catatan</span>
                </button>
                <div class="project-view-action" title="Lihat tugas proyek ${escapeHTML(cat)}">
                    <span>Lihat Tugas</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </div>
            </div>
        `;

        // Click notes badge: opens notes-view filtered to this project!
        const notesBadge = card.querySelector('.project-notes-badge');
        if (notesBadge) {
            notesBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                notesProjectFilter = cat;
                const filterSelect = document.getElementById('notes-project-filter');
                if (filterSelect) filterSelect.value = cat;
                switchTab('notes-view');
                renderNotesList();
                const firstNote = notesList.find(n => (n.project || 'Project') === cat);
                if (firstNote) {
                    selectNote(firstNote.id);
                } else {
                    showEmptyNotesEditor();
                }
            });
        }

        card.onclick = () => {
            // Filter to this project in todo-view
            currentCategoryFilter = cat;
            updateSidebarCounts();
            switchTab('todo-view');
        };
        gridEl.appendChild(card);
    });
}

// ==========================================================================
// RENDER 4: MULTI-DOCUMENT NOTES SYSTEM (MODERN TITLE, PROJECT LINK & ACTION-TO-TASK)
// ==========================================================================
let notesList = [];
let activeNoteId = null;
let notesSearchQuery = '';
let notesProjectFilter = 'all';
let noteAutoSaveTimeout = null;

function formatNoteDate(isoStr) {
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        if (isToday) {
            return `Hari ini, ${hours}:${mins}`;
        }
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
            return `Kemarin, ${hours}:${mins}`;
        }
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) {
        return '';
    }
}

function getNotesStorageKey() {
    return `taskmaster_notes_list_${getUserIdentifier()}`;
}

function saveNotesToStorage() {
    try {
        localStorage.setItem(getNotesStorageKey(), JSON.stringify(notesList));
    } catch (e) {
        console.error('Failed to save notes list:', e);
    }
}

function updateWordCount(content = '') {
    const wordCountEl = document.getElementById('note-word-count');
    if (!wordCountEl) return;
    const trimmed = (content || '').trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = (content || '').length;
    wordCountEl.textContent = `${words} kata • ${chars} karakter`;
}

function updateNotesProjectSelects() {
    const allCats = getAllCategories();

    // 1. Sidebar notes project filter
    const filterSelect = document.getElementById('notes-project-filter');
    if (filterSelect) {
        const curFilter = notesProjectFilter;
        filterSelect.innerHTML = `<option value="all">Semua Proyek</option>`;
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === curFilter) opt.selected = true;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = curFilter;
    }

    // 2. Editor note project select
    const noteSelect = document.getElementById('note-project-select');
    if (noteSelect) {
        const activeNote = notesList.find(n => n.id === activeNoteId);
        const curProject = activeNote ? (activeNote.project || 'Project') : 'Project';
        noteSelect.innerHTML = '';
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === curProject) opt.selected = true;
            noteSelect.appendChild(opt);
        });
        noteSelect.value = curProject;
    }
}

let notesListenersInitialized = false;

function loadNotesForCurrentUser() {
    // 1. Load from user-isolated storage key
    const rawSavedList = localStorage.getItem(getNotesStorageKey());
    if (rawSavedList) {
        try {
            notesList = JSON.parse(rawSavedList);
        } catch (_) {
            notesList = [];
        }
    } else {
        // New user starts completely clean (empty notes)
        notesList = [];
    }

    // Ensure every note has a project
    notesList.forEach(n => {
        if (!n.project) n.project = 'Project';
    });

    // Set initial active note
    if (notesList.length > 0) {
        activeNoteId = notesList[0].id;
    } else {
        activeNoteId = null;
    }

    renderNotesList();
    if (activeNoteId) {
        selectNote(activeNoteId);
    } else {
        showEmptyNotesEditor();
    }
}

function initNotes() {
    loadNotesForCurrentUser();

    if (notesListenersInitialized) return;
    notesListenersInitialized = true;

    // 3. Setup event listeners
    const createBtn = document.getElementById('btn-create-note');
    if (createBtn) {
        createBtn.addEventListener('click', createNewNote);
    }

    const emptyCreateBtn = document.getElementById('btn-empty-create-note');
    if (emptyCreateBtn) {
        emptyCreateBtn.addEventListener('click', createNewNote);
    }

    const searchInput = document.getElementById('notes-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            notesSearchQuery = e.target.value.trim().toLowerCase();
            renderNotesList();
        });
    }

    const notesProjFilter = document.getElementById('notes-project-filter');
    if (notesProjFilter) {
        notesProjFilter.addEventListener('change', (e) => {
            notesProjectFilter = e.target.value;
            renderNotesList();
            if (notesProjectFilter !== 'all') {
                const matching = notesList.find(n => (n.project || 'Project') === notesProjectFilter);
                if (matching) {
                    selectNote(matching.id);
                } else {
                    showEmptyNotesEditor();
                }
            }
        });
    }

    const noteProjSelect = document.getElementById('note-project-select');
    if (noteProjSelect) {
        noteProjSelect.addEventListener('change', (e) => {
            if (!activeNoteId) return;
            const note = notesList.find(n => n.id === activeNoteId);
            if (!note) return;
            note.project = e.target.value;
            note.updated_at = new Date().toISOString();
            saveNotesToStorage();
            renderNotesList();
            renderProjects();
            showToast(`Catatan ditautkan ke proyek "${note.project}"!`);
        });
    }

    const convertBtn = document.getElementById('btn-convert-note-to-task');
    if (convertBtn) {
        convertBtn.addEventListener('click', openNoteToTaskModal);
    }

    const closeConvertModalBtn = document.getElementById('close-note-to-task-modal-btn');
    if (closeConvertModalBtn) {
        closeConvertModalBtn.addEventListener('click', closeNoteToTaskModal);
    }

    const cancelConvertBtn = document.getElementById('cancel-note-to-task-btn');
    if (cancelConvertBtn) {
        cancelConvertBtn.addEventListener('click', closeNoteToTaskModal);
    }

    const noteToTaskForm = document.getElementById('note-to-task-form');
    if (noteToTaskForm) {
        noteToTaskForm.addEventListener('submit', submitNoteToTasks);
    }

    const selectAllBtn = document.getElementById('btn-convert-select-all');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.convert-task-checkbox').forEach(cb => {
                cb.checked = true;
                cb.closest('.convert-task-row')?.classList.add('selected');
            });
            updateConvertSubmitBtnCount();
        });
    }

    const deselectAllBtn = document.getElementById('btn-convert-deselect-all');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.convert-task-checkbox').forEach(cb => {
                cb.checked = false;
                cb.closest('.convert-task-row')?.classList.remove('selected');
            });
            updateConvertSubmitBtnCount();
        });
    }

    const titleInput = document.getElementById('note-title-input');
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            triggerAutoSave();
        });
    }

    const bodyTextarea = document.getElementById('note-body-textarea');
    if (bodyTextarea) {
        bodyTextarea.addEventListener('input', () => {
            triggerAutoSave();
        });
    }

    const copyBtn = document.getElementById('btn-copy-note');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyActiveNote);
    }

    const deleteBtn = document.getElementById('btn-delete-note');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (activeNoteId) deleteNote(activeNoteId);
        });
    }

    // Initial render
    updateNotesProjectSelects();
    renderNotesList();
    if (activeNoteId) {
        selectNote(activeNoteId, false);
    } else {
        showEmptyNotesEditor();
    }
}

function renderNotesList() {
    const listContainer = document.getElementById('notes-list-items');
    const totalBadge = document.getElementById('notes-total-badge');
    if (totalBadge) totalBadge.textContent = notesList.length;
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Filter notes by Project and Search Query
    let filteredNotes = notesList;
    if (notesProjectFilter !== 'all') {
        filteredNotes = filteredNotes.filter(n => (n.project || 'Project') === notesProjectFilter);
    }
    if (notesSearchQuery) {
        filteredNotes = filteredNotes.filter(n => 
            (n.title && n.title.toLowerCase().includes(notesSearchQuery)) ||
            (n.content && n.content.toLowerCase().includes(notesSearchQuery))
        );
    }

    // Sort by updated_at descending (latest first)
    filteredNotes.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

    if (filteredNotes.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'text-align: center; padding: 28px 12px; color: var(--text-muted); font-size: 0.8125rem; font-style: italic;';
        emptyMsg.textContent = (notesSearchQuery || notesProjectFilter !== 'all') ? 'Tidak ada catatan yang cocok' : 'Belum ada catatan';
        listContainer.appendChild(emptyMsg);
        return;
    }

    filteredNotes.forEach(note => {
        const card = document.createElement('div');
        const isActive = (note.id === activeNoteId);
        card.className = `note-list-card ${isActive ? 'active' : ''}`;
        card.id = `note-card-${note.id}`;

        const displayTitle = note.title || 'Untitled Note';
        const displaySnippet = (note.content || '').trim() || 'Tidak ada teks tambahan...';
        const dateStr = formatNoteDate(note.updated_at);
        const proj = note.project || 'Project';
        const projColor = getCategoryColor(proj);

        card.innerHTML = `
            <div class="note-card-top">
                <span class="note-card-title" title="${escapeHTML(displayTitle)}">${escapeHTML(displayTitle)}</span>
                <button type="button" class="note-card-delete-btn" title="Hapus catatan" data-note-id="${note.id}">&times;</button>
            </div>
            <div class="note-card-snippet">${escapeHTML(displaySnippet)}</div>
            <div class="note-card-meta">
                <span class="note-card-project-pill" style="border-left: 3px solid ${projColor};">${escapeHTML(proj)}</span>
                <span>${dateStr}</span>
            </div>
        `;

        // Click card to select
        card.addEventListener('click', (e) => {
            if (e.target.closest('.note-card-delete-btn')) return;
            selectNote(note.id, false);
        });

        // Delete button inside card
        const delBtn = card.querySelector('.note-card-delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(note.id);
            });
        }

        listContainer.appendChild(card);
    });
}

function selectNote(noteId, focusEditor = false) {
    activeNoteId = noteId;
    const note = notesList.find(n => n.id === noteId);

    const editorPanel = document.getElementById('notes-editor-panel');
    const emptyState = document.getElementById('notes-empty-editor');

    if (!note) {
        showEmptyNotesEditor();
        return;
    }

    if (editorPanel) editorPanel.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    // Update active class on cards
    document.querySelectorAll('.note-list-card').forEach(card => {
        card.classList.toggle('active', card.id === `note-card-${noteId}`);
    });

    const titleInput = document.getElementById('note-title-input');
    const bodyTextarea = document.getElementById('note-body-textarea');
    const dateInfo = document.getElementById('note-date-info');
    const saveStatus = document.getElementById('note-save-status');
    const projectSelect = document.getElementById('note-project-select');

    if (titleInput) titleInput.value = note.title || '';
    if (bodyTextarea) bodyTextarea.value = note.content || '';
    if (dateInfo) dateInfo.textContent = `Diperbarui ${formatNoteDate(note.updated_at)}`;
    if (projectSelect) {
        updateNotesProjectSelects();
        projectSelect.value = note.project || 'Project';
    }

    if (saveStatus) {
        saveStatus.className = 'note-save-status';
        saveStatus.innerHTML = '<span class="status-dot"></span> Tersimpan otomatis';
    }

    updateWordCount(note.content || '');

    if (focusEditor && bodyTextarea) {
        bodyTextarea.focus();
    }
}

function showEmptyNotesEditor() {
    const editorPanel = document.getElementById('notes-editor-panel');
    const emptyState = document.getElementById('notes-empty-editor');
    if (editorPanel) editorPanel.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
}

function createNewNote() {
    const defaultProj = notesProjectFilter !== 'all'
        ? notesProjectFilter
        : (currentCategoryFilter !== 'all' ? currentCategoryFilter : 'Project');

    const newNote = {
        id: Date.now(),
        title: 'Catatan Baru',
        content: '',
        project: defaultProj,
        updated_at: new Date().toISOString()
    };

    notesList.unshift(newNote);
    activeNoteId = newNote.id;
    saveNotesToStorage();

    // Reset search query so user can see their new note
    const searchInput = document.getElementById('notes-search-input');
    if (searchInput && notesSearchQuery) {
        searchInput.value = '';
        notesSearchQuery = '';
    }

    renderNotesList();
    renderProjects();
    selectNote(newNote.id, false);

    // Focus & select title input immediately
    const titleInput = document.getElementById('note-title-input');
    if (titleInput) {
        titleInput.focus();
        titleInput.select();
    }

    showToast('📝 Catatan baru berhasil dibuat!');
}

function triggerAutoSave() {
    if (!activeNoteId) return;
    const note = notesList.find(n => n.id === activeNoteId);
    if (!note) return;

    const titleInput = document.getElementById('note-title-input');
    const bodyTextarea = document.getElementById('note-body-textarea');
    const saveStatus = document.getElementById('note-save-status');

    const newTitle = titleInput ? titleInput.value : '';
    const newContent = bodyTextarea ? bodyTextarea.value : '';

    note.title = newTitle.trim() || 'Untitled Note';
    note.content = newContent;
    note.updated_at = new Date().toISOString();

    updateWordCount(newContent);

    if (saveStatus) {
        saveStatus.className = 'note-save-status saving';
        saveStatus.innerHTML = '<span class="status-dot"></span> Menyimpan...';
    }

    // Live update title and snippet on active sidebar card directly
    const activeCard = document.getElementById(`note-card-${note.id}`);
    if (activeCard) {
        const titleEl = activeCard.querySelector('.note-card-title');
        const snippetEl = activeCard.querySelector('.note-card-snippet');
        const metaEl = activeCard.querySelector('.note-card-meta span:last-child');
        if (titleEl) {
            titleEl.textContent = note.title;
            titleEl.title = note.title;
        }
        if (snippetEl) snippetEl.textContent = note.content.trim() || 'Tidak ada teks tambahan...';
        if (metaEl) metaEl.textContent = formatNoteDate(note.updated_at);
    }

    clearTimeout(noteAutoSaveTimeout);
    noteAutoSaveTimeout = setTimeout(() => {
        saveNotesToStorage();
        if (saveStatus) {
            saveStatus.className = 'note-save-status';
            saveStatus.innerHTML = '<span class="status-dot"></span> Tersimpan otomatis';
        }
        const dateInfo = document.getElementById('note-date-info');
        if (dateInfo) dateInfo.textContent = `Diperbarui ${formatNoteDate(note.updated_at)}`;
    }, 400);
}

function deleteNote(noteId) {
    const idx = notesList.findIndex(n => n.id === noteId);
    if (idx === -1) return;

    const deletedNote = notesList[idx];
    notesList.splice(idx, 1);
    saveNotesToStorage();

    if (activeNoteId === noteId) {
        activeNoteId = notesList.length > 0 ? notesList[0].id : null;
    }

    renderNotesList();
    renderProjects();
    if (activeNoteId) {
        selectNote(activeNoteId, false);
    } else {
        showEmptyNotesEditor();
    }

    showToast(`Catatan "${deletedNote.title}" telah dihapus.`);
}

function copyActiveNote() {
    if (!activeNoteId) return;
    const note = notesList.find(n => n.id === activeNoteId);
    if (!note) return;

    const fullText = `${note.title}\n\n${note.content}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText).then(() => {
            showToast('📋 Catatan berhasil disalin ke clipboard!');
        }).catch(() => {
            showToast('Gagal menyalin catatan.', true);
        });
    } else {
        const temp = document.createElement('textarea');
        temp.value = fullText;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showToast('📋 Catatan berhasil disalin ke clipboard!');
    }
}

// ==========================================================================
// ACTION-TO-TASK: CONVERT NOTE LINES TO TO-DO LIST TASKS
// ==========================================================================
function parseActionItemsFromContent(content = '') {
    if (!content) return [];
    const lines = content.split('\n');
    const items = [];
    lines.forEach(line => {
        let text = line.trim();
        if (!text) return;
        // Remove numbering e.g. "1. ", "1) ", "1 - "
        text = text.replace(/^(\d+[\.\)\-]\s*)/, '');
        // Remove bullet markers e.g. "- ", "* ", "• ", "+ "
        text = text.replace(/^([\-\*\•\+]\s*)/, '');
        // Remove checkbox marks e.g. "[ ] ", "[x] ", "[X] ", "✓ "
        text = text.replace(/^(\[[\sxX]?\]\s*|✓\s*)/, '');
        text = text.trim();
        if (text && text.length >= 2) {
            items.push(text);
        }
    });
    return items;
}

function openNoteToTaskModal() {
    if (!activeNoteId) {
        showToast('Pilih catatan terlebih dahulu.', true);
        return;
    }
    const note = notesList.find(n => n.id === activeNoteId);
    if (!note) return;

    const modal = document.getElementById('note-to-task-modal');
    if (!modal) return;

    const titleEl = document.getElementById('note-to-task-modal-title');
    if (titleEl) {
        titleEl.textContent = `Jadikan Tugas: "${note.title || 'Catatan'}"`;
    }

    // Populate target project select
    const projectSelect = document.getElementById('convert-target-project');
    if (projectSelect) {
        projectSelect.innerHTML = '';
        const allCats = getAllCategories();
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === (note.project || 'Project')) opt.selected = true;
            projectSelect.appendChild(opt);
        });
    }

    // Default due date to today
    const dateInput = document.getElementById('convert-target-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Parse action items
    const items = parseActionItemsFromContent(note.content);
    const itemsListEl = document.getElementById('convert-task-items-list');
    const countEl = document.getElementById('convert-detected-count');

    if (countEl) countEl.textContent = `Poin Terdeteksi: ${items.length}`;
    if (itemsListEl) {
        itemsListEl.innerHTML = '';
        if (items.length === 0) {
            itemsListEl.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.8125rem; font-style: italic;">
                    Tidak ada baris teks yang terdeteksi di catatan ini.<br>Ketik beberapa baris tugas (misal: 1. ..., 2. ...) di catatan terlebih dahulu.
                </div>
            `;
            const submitBtn = document.getElementById('submit-convert-to-tasks-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span>⚡ Tambahkan ke To-Do List</span>`;
            }
        } else {
            const submitBtn = document.getElementById('submit-convert-to-tasks-btn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>⚡ Tambahkan (${items.length}) Tugas ke To-Do List</span>`;
            }

            items.forEach((itemText, idx) => {
                const row = document.createElement('div');
                row.className = 'convert-task-row selected';
                row.innerHTML = `
                    <input type="checkbox" class="convert-task-checkbox" id="convert-item-${idx}" checked>
                    <input type="text" class="convert-task-input" value="${escapeHTML(itemText)}" placeholder="Nama tugas...">
                `;

                const cb = row.querySelector('.convert-task-checkbox');
                cb.addEventListener('change', () => {
                    row.classList.toggle('selected', cb.checked);
                    updateConvertSubmitBtnCount();
                });

                itemsListEl.appendChild(row);
            });
        }
    }

    modal.classList.remove('hidden');
}

function updateConvertSubmitBtnCount() {
    const checkedBoxes = document.querySelectorAll('.convert-task-checkbox:checked');
    const submitBtn = document.getElementById('submit-convert-to-tasks-btn');
    if (submitBtn) {
        submitBtn.disabled = checkedBoxes.length === 0;
        submitBtn.innerHTML = `<span>⚡ Tambahkan (${checkedBoxes.length}) Tugas ke To-Do List</span>`;
    }
}

function closeNoteToTaskModal() {
    const modal = document.getElementById('note-to-task-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitNoteToTasks(e) {
    e.preventDefault();
    if (!activeNoteId) return;
    const note = notesList.find(n => n.id === activeNoteId);
    if (!note) return;

    const rows = document.querySelectorAll('.convert-task-row');
    const selectedTasks = [];
    rows.forEach(row => {
        const cb = row.querySelector('.convert-task-checkbox');
        const input = row.querySelector('.convert-task-input');
        if (cb && cb.checked && input && input.value.trim()) {
            selectedTasks.push(input.value.trim());
        }
    });

    if (selectedTasks.length === 0) {
        showToast('Pilih minimal satu poin tugas untuk ditambahkan.', true);
        return;
    }

    const targetProject = document.getElementById('convert-target-project')?.value || note.project || 'Project';
    const targetDueDate = document.getElementById('convert-target-date')?.value || null;

    const submitBtn = document.getElementById('submit-convert-to-tasks-btn');
    const originalHTML = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Menyimpan tugas...</span>';
    }

    let successCount = 0;
    try {
        for (const title of selectedTasks) {
            const taskData = {
                title: title,
                description: `Dibuat dari catatan: "${note.title || 'Untitled'}"`,
                status: 'todo',
                category: targetProject,
                due_date: targetDueDate,
                due_time: null
            };
            const data = await apiFetch(`${API_BASE}/tasks`, {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
            if (data && data.task) {
                tasks.push(data.task);
                successCount++;
            }
        }

        closeNoteToTaskModal();

        // Confetti celebration 🎉
        if (window.confetti) {
            window.confetti({
                particleCount: 55,
                spread: 60,
                origin: { y: 0.7 }
            });
        }

        showToast(`🎉 ${successCount} tugas berhasil ditambahkan ke proyek "${targetProject}"!`);

        // Refresh dashboard across views
        updateSidebarCounts();
        renderTasks();
        if (currentView === 'calendar-view') renderCalendar();
        if (currentView === 'project-view') renderProjects();

    } catch (err) {
        showToast(`Gagal menambahkan tugas: ${err.message}`, true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
        }
    }
}

// --- SIDEBAR COUNTS & CATEGORIES ---
function updateSidebarCounts() {
    const allCountEl = document.getElementById('all-tasks-count');
    if (allCountEl) allCountEl.textContent = tasks.length;

    const catList = document.getElementById('category-list');
    if (catList) {
        catList.innerHTML = '';
        const allCategories = getAllCategories();
        allCategories.forEach(cat => {
            const count = tasks.filter(t => (t.category || 'Project') === cat).length;
            const li = document.createElement('li');
            li.className = `nav-item ${currentCategoryFilter === cat ? 'active' : ''}`;
            li.dataset.filterCat = cat;

            const icon = cat === 'Personal Project' ? '📁' : (cat === 'Project' ? '💼' : '📂');

            li.innerHTML = `
                <span class="nav-icon">${icon}</span>
                <span class="nav-text">${escapeHTML(cat)}</span>
                <span class="cat-count">${count}</span>
            `;

            li.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                li.classList.add('active');
                currentCategoryFilter = cat;
                switchTab('todo-view');
            });

            catList.appendChild(li);
        });

        if (!catList.classList.contains('collapsed')) {
            catList.style.maxHeight = 'none';
        }
    }

    updateTaskModalCategories();
    if (typeof updateNotesProjectSelects === 'function') {
        updateNotesProjectSelects();
    }
}

// --- MODAL DIALOG (ADD / EDIT) ---
function openNewModalWithDate(dateStr = '', timeStr = '') {
    document.getElementById('modal-title').textContent = 'New Task';
    document.getElementById('task-edit-id').value = '';
    document.getElementById('modal-task-title').value = '';
    document.getElementById('modal-task-desc').value = '';
    document.getElementById('modal-task-status').value = 'todo';
    document.getElementById('modal-task-cat').value = currentCategoryFilter !== 'all' ? currentCategoryFilter : 'Project';
    document.getElementById('modal-task-date').value = dateStr || new Date().toISOString().split('T')[0];
    const timeInput = document.getElementById('modal-task-time');
    if (timeInput) timeInput.value = timeStr || '';
    taskModal.classList.remove('hidden');
}

function openEditModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('task-edit-id').value = task.id;
    document.getElementById('modal-task-title').value = task.title;
    document.getElementById('modal-task-desc').value = task.description || '';
    document.getElementById('modal-task-status').value = task.status || 'todo';
    document.getElementById('modal-task-cat').value = task.category || 'Project';
    document.getElementById('modal-task-date').value = task.due_date || '';
    const timeInput = document.getElementById('modal-task-time');
    if (timeInput) timeInput.value = task.due_time || '';
    taskModal.classList.remove('hidden');
}

function closeModal() {
    taskModal.classList.add('hidden');
}

// --- EVENT LISTENERS SETUP ---
function setupEventListeners() {
    // Auth Alert Close Button
    if (authAlertClose) {
        authAlertClose.addEventListener('click', clearAuthAlert);
    }

    // Clear input-error styling as soon as the user starts typing
    document.querySelectorAll('.auth-form input').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
        });
    });

    // Auth Tabs (Login / Register)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.dataset.target || e.target.dataset.target;
            if (targetId) {
                switchAuthTab(targetId);
            }
        });
    });

    // Password Visibility Toggle (Fitur Buka / Tutup Mata)
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetId = btn.dataset.target;
            const inputEl = document.getElementById(targetId);
            if (!inputEl) return;

            const isCurrentlyPassword = (inputEl.type === 'password');
            if (isCurrentlyPassword) {
                inputEl.type = 'text';
                btn.classList.add('visible');
                btn.title = 'Sembunyikan Password';
                btn.setAttribute('aria-label', 'Sembunyikan kata sandi');
            } else {
                inputEl.type = 'password';
                btn.classList.remove('visible');
                btn.title = 'Lihat Password';
                btn.setAttribute('aria-label', 'Lihat kata sandi');
            }
            inputEl.focus();
        });
    });

    // Password Strength Meter listener
    const regPasswordInput = document.getElementById('reg-password');
    if (regPasswordInput) {
        regPasswordInput.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value);
        });
    }

    // Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('login-submit-btn') || loginForm.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true, 'Memverifikasi...');

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        try {
            await handleAuth(`${API_BASE}/auth/login`, { email, password });
        } finally {
            setButtonLoading(submitBtn, false);
        }
    });

    // Register Form Submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('register-submit-btn') || registerForm.querySelector('button[type="submit"]');

        const full_name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (password.length < 6) {
            showAuthAlert('Kata sandi minimal 6 karakter. Silakan lengkapi kata sandi Anda.', true);
            showToast('Kata sandi minimal 6 karakter.', true);
            const regPw = document.getElementById('reg-password');
            if (regPw) {
                regPw.classList.add('input-error');
                regPw.focus();
            }
            return;
        }

        setButtonLoading(submitBtn, true, 'Mendaftarkan...');
        try {
            await handleAuth(`${API_BASE}/auth/register`, { full_name, email, password }, true);
        } finally {
            setButtonLoading(submitBtn, false);
        }
    });

    // Logout Button
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Sidebar Toggle Button (Buka/Tutup ☰) & Mobile Drawer
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const timelineBackdrop = document.getElementById('timeline-backdrop');

    function isMobileScreen() {
        return window.innerWidth <= 768;
    }

    function closeMobileSidebar() {
        if (isMobileScreen() && sidebar) {
            sidebar.classList.add('collapsed');
            if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
        }
    }

    if (sidebarToggleBtn && sidebar) {
        // Pada layar mobile, default sidebar tertutup agar dashboard utama langsung terlihat
        if (isMobileScreen()) {
            sidebar.classList.add('collapsed');
        } else {
            // Pulihkan status sidebar sebelumnya dari localStorage pada desktop
            const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
            if (isCollapsed) {
                sidebar.classList.add('collapsed');
            }
        }

        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const currentlyCollapsed = sidebar.classList.contains('collapsed');
            if (isMobileScreen()) {
                if (sidebarBackdrop) {
                    sidebarBackdrop.classList.toggle('hidden', currentlyCollapsed);
                }
            } else {
                localStorage.setItem('sidebar_collapsed', currentlyCollapsed);
            }
        });

        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', closeMobileSidebar);
        }

        // Tutup otomatis drawer sidebar saat user klik menu navigasi di mobile
        sidebar.querySelectorAll('.nav-item, #logout-btn, #settings-btn').forEach(item => {
            item.addEventListener('click', () => {
                if (isMobileScreen()) closeMobileSidebar();
            });
        });
    }

    if (timelineBackdrop) {
        timelineBackdrop.addEventListener('click', closeDayTimeline);
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && sidebarBackdrop) {
            sidebarBackdrop.classList.add('hidden');
        }
        if (window.innerWidth > 1024 && timelineBackdrop) {
            timelineBackdrop.classList.add('hidden');
        }
    });

    // Top Navigation Tabs (To-do, Calendar, Project, Notes)
    document.querySelectorAll('.top-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchTab(e.target.dataset.view);
        });
    });

    // Sidebar Category Filter
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = e.currentTarget;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            target.classList.add('active');
            currentCategoryFilter = target.dataset.filterCat;
            switchTab('todo-view');
        });
    });

    // Modal Tambah Kategori / Proyek (Pop Box di Tengah, menggantikan prompt())
    const categoryModal = document.getElementById('category-modal');
    const categoryForm = document.getElementById('category-modal-form');
    const newCategoryInput = document.getElementById('new-category-name');
    const openCatModalBtn = document.getElementById('add-category-btn');
    const closeCatModalBtn = document.getElementById('close-category-modal-btn');
    const cancelCatModalBtn = document.getElementById('cancel-category-modal-btn');

    function openCategoryModal() {
        if (!categoryModal) return;
        newCategoryInput.value = '';
        categoryModal.classList.remove('hidden');
        newCategoryInput.focus();
    }

    function closeCategoryModal() {
        if (!categoryModal) return;
        categoryModal.classList.add('hidden');
    }

    // Toggle Category / Project List in Sidebar (Panah Atas/Bawah dengan Animasi Smooth)
    const toggleCatListBtn = document.getElementById('toggle-category-list-btn');
    const categoryListEl = document.getElementById('category-list');
    const categoryArrowEl = document.getElementById('category-list-arrow');
    let catListAnimTimeout = null;

    function applyCategoryListCollapsedState(isCollapsed, animate = true) {
        if (!categoryListEl || !categoryArrowEl) return;
        clearTimeout(catListAnimTimeout);

        if (!animate) {
            categoryListEl.style.transition = 'none';
            categoryArrowEl.style.transition = 'none';
            if (isCollapsed) {
                categoryListEl.classList.add('collapsed');
                categoryListEl.style.maxHeight = '0px';
                categoryArrowEl.classList.add('collapsed');
                categoryArrowEl.title = 'Tampilkan list';
            } else {
                categoryListEl.classList.remove('collapsed');
                categoryListEl.style.maxHeight = 'none';
                categoryArrowEl.classList.remove('collapsed');
                categoryArrowEl.title = 'Sembunyikan list';
            }
            void categoryListEl.offsetHeight; // Force reflow
            categoryListEl.style.transition = '';
            categoryArrowEl.style.transition = '';
            return;
        }

        if (isCollapsed) {
            // Set exact starting height before animating to 0
            categoryListEl.style.maxHeight = categoryListEl.scrollHeight + 'px';
            void categoryListEl.offsetHeight; // Force reflow
            categoryListEl.classList.add('collapsed');
            categoryListEl.style.maxHeight = '0px';
            categoryArrowEl.classList.add('collapsed');
            categoryArrowEl.title = 'Tampilkan list';
        } else {
            categoryListEl.classList.remove('collapsed');
            categoryListEl.style.maxHeight = categoryListEl.scrollHeight + 'px';
            categoryArrowEl.classList.remove('collapsed');
            categoryArrowEl.title = 'Sembunyikan list';
            catListAnimTimeout = setTimeout(() => {
                if (!categoryListEl.classList.contains('collapsed')) {
                    categoryListEl.style.maxHeight = 'none';
                }
            }, 350);
        }
    }

    // Restore saved state from localStorage (instant on load, no lag)
    const savedCatCollapsed = localStorage.getItem('taskmaster_category_list_collapsed') === 'true';
    applyCategoryListCollapsedState(savedCatCollapsed, false);

    if (toggleCatListBtn) {
        toggleCatListBtn.addEventListener('click', () => {
            const isCurrentlyCollapsed = categoryListEl ? categoryListEl.classList.contains('collapsed') : false;
            const newState = !isCurrentlyCollapsed;
            applyCategoryListCollapsedState(newState, true);
            localStorage.setItem('taskmaster_category_list_collapsed', newState);
        });
    }

    const projectAddBtn = document.getElementById('project-add-btn');
    if (projectAddBtn) {
        projectAddBtn.addEventListener('click', openCategoryModal);
    }
    if (openCatModalBtn) {
        openCatModalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCategoryModal();
        });
    }
    if (closeCatModalBtn) {
        closeCatModalBtn.addEventListener('click', closeCategoryModal);
    }
    if (cancelCatModalBtn) {
        cancelCatModalBtn.addEventListener('click', closeCategoryModal);
    }
    if (categoryModal) {
        categoryModal.addEventListener('click', (e) => {
            if (e.target === categoryModal) closeCategoryModal();
        });
    }

    if (categoryForm) {
        categoryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const catName = newCategoryInput.value.trim();
            if (catName) {
                applyCategoryListCollapsedState(false, true);
                localStorage.setItem('taskmaster_category_list_collapsed', 'false');
                addCategory(catName);
                closeCategoryModal();
                showToast(`Proyek "${catName}" berhasil ditambahkan!`);
            }
        });
    }

    // Quick Status Filter Pills (All, Active, Completed) in To-Do View
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            const filter = e.target.dataset.filter;
            if (filter === 'active') {
                document.getElementById('active-tasks-table').parentElement.style.display = 'block';
                document.getElementById('completed-tasks-table').parentElement.style.display = 'none';
            } else if (filter === 'completed') {
                document.getElementById('active-tasks-table').parentElement.style.display = 'none';
                document.getElementById('completed-tasks-table').parentElement.style.display = 'block';
            } else {
                document.getElementById('active-tasks-table').parentElement.style.display = 'block';
                document.getElementById('completed-tasks-table').parentElement.style.display = 'block';
            }
        });
    });

    // Collapsible Groups Toggle (Smooth Accordion Transition)
    let activeGroupAnimTimeout = null;
    let completedGroupAnimTimeout = null;

    function toggleTaskGroup(headerEl, tableEl, isCompleted = false) {
        if (!headerEl || !tableEl) return;
        const willCollapse = !headerEl.classList.contains('collapsed');

        if (isCompleted) {
            clearTimeout(completedGroupAnimTimeout);
        } else {
            clearTimeout(activeGroupAnimTimeout);
        }

        if (willCollapse) {
            tableEl.style.maxHeight = tableEl.scrollHeight + 'px';
            void tableEl.offsetHeight; // Force reflow
            headerEl.classList.add('collapsed');
            tableEl.classList.add('collapsed');
            tableEl.style.maxHeight = '0px';
        } else {
            headerEl.classList.remove('collapsed');
            tableEl.classList.remove('collapsed');
            tableEl.style.maxHeight = tableEl.scrollHeight + 'px';
            const tid = setTimeout(() => {
                if (!tableEl.classList.contains('collapsed')) {
                    tableEl.style.maxHeight = 'none';
                }
            }, 380);
            if (isCompleted) {
                completedGroupAnimTimeout = tid;
            } else {
                activeGroupAnimTimeout = tid;
            }
        }
    }

    const toggleActiveHeader = document.getElementById('toggle-active-tasks');
    const activeTasksTable = document.getElementById('active-tasks-table');
    if (toggleActiveHeader && activeTasksTable) {
        toggleActiveHeader.addEventListener('click', () => {
            toggleTaskGroup(toggleActiveHeader, activeTasksTable, false);
        });
    }

    const toggleCompletedHeader = document.getElementById('toggle-completed-tasks');
    const completedTasksTable = document.getElementById('completed-tasks-table');
    if (toggleCompletedHeader && completedTasksTable) {
        toggleCompletedHeader.addEventListener('click', () => {
            toggleTaskGroup(toggleCompletedHeader, completedTasksTable, true);
        });
    }

    // Search Input
    document.getElementById('task-search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTasks();
    });

    // Open Task Modal Button (+ Add task)
    document.getElementById('open-task-modal-btn').addEventListener('click', () => {
        openNewModalWithDate();
    });

    // Close Modal Buttons
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-modal-btn').addEventListener('click', closeModal);
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) closeModal();
    });

    // Modal Form Submission
    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = document.getElementById('task-edit-id').value;
        const taskData = {
            title: document.getElementById('modal-task-title').value.trim(),
            description: document.getElementById('modal-task-desc').value.trim(),
            status: document.getElementById('modal-task-status').value,
            category: document.getElementById('modal-task-cat').value,
            due_date: document.getElementById('modal-task-date').value || null,
            due_time: document.getElementById('modal-task-time')?.value || null
        };
        await saveTask(taskData, taskId ? parseInt(taskId) : null);
    });

    // Calendar Navigation Controls
    document.getElementById('cal-prev-btn').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('cal-next-btn').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('cal-today-btn').addEventListener('click', () => {
        calendarDate = new Date();
        renderCalendar();
        // Also open timeline for today if user clicks Today
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        openDayTimeline(todayStr);
    });

    // Calendar Project Filter Dropdown
    const calFilter = document.getElementById('cal-project-filter');
    if (calFilter) {
        calFilter.addEventListener('change', (e) => {
            calendarCategoryFilter = e.target.value;
            renderCalendar();
            if (selectedTimelineDate) {
                renderDayTimeline();
            }
        });
    }

    // Day Timeline Side Panel Event Listeners
    const closeTimelineBtn = document.getElementById('close-timeline-panel-btn');
    if (closeTimelineBtn) {
        closeTimelineBtn.addEventListener('click', closeDayTimeline);
    }

    const timelineAddTaskBtn = document.getElementById('timeline-add-task-btn');
    if (timelineAddTaskBtn) {
        timelineAddTaskBtn.addEventListener('click', () => {
            if (selectedTimelineDate) {
                openNewModalWithDate(selectedTimelineDate);
            }
        });
    }

    const toggleAllDayBtn = document.getElementById('toggle-all-day-btn');
    const allDayListEl = document.getElementById('timeline-all-day-list');
    if (toggleAllDayBtn && allDayListEl) {
        toggleAllDayBtn.addEventListener('click', () => {
            const icon = toggleAllDayBtn.querySelector('.all-day-toggle-icon');
            if (allDayListEl.style.display === 'none') {
                allDayListEl.style.display = 'flex';
                if (icon) icon.textContent = '▾';
            } else {
                allDayListEl.style.display = 'none';
                if (icon) icon.textContent = '▸';
            }
        });
    }
}

// --- UTILITIES ---
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Global scope registration for inline events
window.toggleTaskStatus = toggleTaskStatus;
window.deleteTask = deleteTask;
window.openEditModal = openEditModal;
window.switchAuthTab = switchAuthTab;
window.handleGoogleCallback = handleGoogleCallback;
window.openStatusPopover = openStatusPopover;
window.handleCheckboxToggle = handleCheckboxToggle;
window.openDayTimeline = openDayTimeline;
window.closeDayTimeline = closeDayTimeline;
window.createNewNote = createNewNote;
window.selectNote = selectNote;
window.deleteNote = deleteNote;

// Start Application
init();
