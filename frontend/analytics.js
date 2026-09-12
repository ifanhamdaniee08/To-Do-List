/**
 * TaskMaster - Productivity Analytics & Statistics Module
 * File Modular: Menghitung & Me-render Statistik Pengguna Secara Real-Time
 */

let analyticsAnimTimeout = null;

const ANALYTICS_DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const ANALYTICS_DAY_FULL = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const ANALYTICS_MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Menghitung seluruh metrik produktivitas dari daftar tasks pengguna
 */
function calculateProductivityStats(taskList = []) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0];

    const total = taskList.length;
    const completedTasks = taskList.filter(t => t.is_completed || t.status === 'completed');
    const activeTasks = taskList.filter(t => !t.is_completed && t.status !== 'completed');

    const completedCount = completedTasks.length;
    const activeCount = activeTasks.length;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    // 1. Tugas Terlambat (Overdue Tasks)
    const overdueTasks = activeTasks.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date + 'T00:00:00');
        return dueDate < today;
    });
    const overdueCount = overdueTasks.length;

    // 2. On-Time Completion (Tugas yang selesai sebelum atau pas tanggal tenggat)
    const completedWithDueDate = completedTasks.filter(t => t.due_date);
    let onTimeCount = 0;
    completedWithDueDate.forEach(t => {
        const dueDate = new Date(t.due_date + 'T00:00:00');
        const compDate = t.updated_at ? new Date(t.updated_at) : today;
        compDate.setHours(0, 0, 0, 0);
        if (compDate <= dueDate) {
            onTimeCount++;
        }
    });
    const onTimeRate = completedWithDueDate.length > 0 
        ? Math.round((onTimeCount / completedWithDueDate.length) * 100) 
        : 100;

    // 3. Analisis Hari Paling Produktif (Peak Day) & Bulan Paling Produktif (Peak Month)
    const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // 0 = Mon, 6 = Sun
    const monthCounts = {};
    const dateCompletedMap = {};

    completedTasks.forEach(t => {
        const d = t.updated_at ? new Date(t.updated_at) : (t.created_at ? new Date(t.created_at) : today);
        if (!isNaN(d.getTime())) {
            // JS getDay(): 0 = Sun, 1 = Mon... convert to 0 = Mon, 6 = Sun
            const jsDay = d.getDay();
            const weekday = (jsDay === 0) ? 6 : jsDay - 1;
            dayCounts[weekday] = (dayCounts[weekday] || 0) + 1;

            const mKey = `${ANALYTICS_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
            monthCounts[mKey] = (monthCounts[mKey] || 0) + 1;

            const dKey = d.toISOString().split('T')[0];
            dateCompletedMap[dKey] = (dateCompletedMap[dKey] || 0) + 1;
        }
    });

    let peakDay = null;
    let maxDayCount = 0;
    Object.keys(dayCounts).forEach(dayIdx => {
        const count = dayCounts[dayIdx];
        if (count > maxDayCount) {
            maxDayCount = count;
            peakDay = {
                day: ANALYTICS_DAY_FULL[dayIdx],
                count: count
            };
        }
    });

    let peakMonth = null;
    let maxMonthCount = 0;
    Object.keys(monthCounts).forEach(mKey => {
        const count = monthCounts[mKey];
        if (count > maxMonthCount) {
            maxMonthCount = count;
            peakMonth = {
                month: mKey,
                count: count
            };
        }
    });

    // 4. Aktivitas 7 Hari Terakhir (Mini Weekly Activity Bar)
    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);
        const iso = targetDate.toISOString().split('T')[0];
        const jsDay = targetDate.getDay();
        const weekday = (jsDay === 0) ? 6 : jsDay - 1;
        const count = dateCompletedMap[iso] || 0;

        weeklyActivity.push({
            day_short: ANALYTICS_DAY_NAMES[weekday],
            day_full: ANALYTICS_DAY_FULL[weekday],
            date: iso,
            count: count,
            is_today: (iso === todayISO)
        });
    }

    // 5. Daily Productivity Streak
    let streakCount = 0;
    let checkDate = new Date(today);
    if (dateCompletedMap[todayISO]) {
        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
    } else {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        const iso = checkDate.toISOString().split('T')[0];
        if (dateCompletedMap[iso]) {
            streakCount++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    // 6. Distribusi Fokus Proyek (Project Focus Breakdown)
    const catCounts = {};
    completedTasks.forEach(t => {
        const c = t.category || 'Project';
        catCounts[c] = (catCounts[c] || 0) + 1;
    });

    const categoryBreakdown = Object.keys(catCounts).map(cat => ({
        category: cat,
        count: catCounts[cat],
        percentage: completedCount > 0 ? Math.round((catCounts[cat] / completedCount) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    return {
        total,
        completedCount,
        activeCount,
        completionRate,
        overdueCount,
        onTimeRate,
        onTimeCount,
        peakDay,
        peakMonth,
        weeklyActivity,
        streakCount,
        categoryBreakdown
    };
}

/**
 * Render visual komponen statistik produktivitas ke dalam DOM
 */
function renderProductivityStats() {
    const container = document.getElementById('productivity-stats-container');
    if (!container) return;

    const stats = calculateProductivityStats(typeof tasks !== 'undefined' ? tasks : []);

    // 1. Overdue card visual tone
    const overdueClass = stats.overdueCount > 0 ? 'overdue-alert' : 'overdue-good';
    const overdueTitle = stats.overdueCount > 0 ? `${stats.overdueCount} Terlambat` : `0 Terlambat ✓`;
    const overdueDesc = stats.overdueCount > 0 ? `Perlu perhatian segera` : `Semua tepat waktu!`;

    // 2. Peak day text
    const peakDayText = stats.peakDay ? stats.peakDay.day : 'Belum Ada';
    const peakDaySub = stats.peakDay ? `${stats.peakDay.count} tugas selesai` : 'Selesaikan tugas pertama';

    // 3. Peak month text
    const peakMonthText = stats.peakMonth ? stats.peakMonth.month : 'Bulan Ini';
    const peakMonthSub = stats.peakMonth ? `Rekor ${stats.peakMonth.count} tugas` : 'Mulai produktivitasmu';

    // 4. Max count in weekly activity for bar height scaling
    const maxWeekCount = Math.max(...stats.weeklyActivity.map(d => d.count), 1);

    // Build Weekly Bar items
    const weeklyBarsHTML = stats.weeklyActivity.map(item => {
        const heightPct = item.count > 0 ? Math.max(14, Math.round((item.count / maxWeekCount) * 100)) : 6;
        return `
            <div class="weekly-bar-col ${item.is_today ? 'is-today' : ''}" title="${item.day_full} (${item.date}): ${item.count} tugas selesai">
                <span class="weekly-bar-count ${item.count > 0 ? 'has-count' : ''}">${item.count > 0 ? item.count : ''}</span>
                <div class="weekly-bar-track">
                    <div class="weekly-bar-fill ${item.count > 0 ? 'active' : ''}" style="height: ${heightPct}%;"></div>
                </div>
                <span class="weekly-bar-label">${item.day_short}</span>
            </div>
        `;
    }).join('');

    // Build Category breakdown bars
    let categoryBarsHTML = '';
    if (stats.categoryBreakdown.length === 0) {
        categoryBarsHTML = `
            <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; padding: 6px 0;">
                Belum ada tugas selesai untuk pembagian kategori.
            </div>
        `;
    } else {
        categoryBarsHTML = stats.categoryBreakdown.slice(0, 3).map(catItem => {
            const color = (typeof getCategoryColor === 'function') ? getCategoryColor(catItem.category) : '#2563eb';
            return `
                <div class="stat-cat-row">
                    <div class="stat-cat-info">
                        <span class="stat-cat-dot" style="background-color: ${color};"></span>
                        <span class="stat-cat-name">${escapeHTMLSafe(catItem.category)}</span>
                        <span class="stat-cat-pct">${catItem.percentage}%</span>
                    </div>
                    <div class="stat-cat-bar-bg">
                        <div class="stat-cat-bar-fill" style="width: ${catItem.percentage}%; background-color: ${color};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = `
        <div class="stats-cards-grid">
            <!-- Card 1: Tingkat Penyelesaian (Pixel Check Badge) -->
            <div class="stat-metric-card">
                <div class="stat-card-icon-box bg-blue-subtle" title="Tingkat Selesai">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon">
                        <!-- Pixel Badge Outer Ring -->
                        <path d="M5 1h6v1H5V1zm-2 1h2v1H3V2zm8 0h2v1h-2V2zM2 3h1v2H2V3zm11 0h1v2h-1V3zM1 5h1v6H1V5zm13 0h1v6h-1V5zM2 11h1v2H2v-2zm11 0h1v2h-1v-2zm-8 2h2v1H3v-1zm8 0h2v1h-2v-1zm-6 1h6v1H5v-1z"/>
                        <!-- Pixel Checkmark -->
                        <path d="M3 7h1v2H3zm1 1h1v2H4zm1 1h1v2H5zm1 1h1v2H6zm1-1h1v2H7zm1-1h1v2H8zm1-1h1v2H9zm1-1h1v2h-1zm1-1h1v2h-1zm1-1h1v2h-1z"/>
                    </svg>
                </div>
                <div class="stat-metric-content">
                    <span class="stat-metric-label">Tingkat Selesai</span>
                    <div class="stat-metric-value-row">
                        <span class="stat-metric-number">${stats.completionRate}%</span>
                        <span class="stat-metric-pill bg-blue-pill">${stats.completedCount}/${stats.total}</span>
                    </div>
                    <span class="stat-metric-sub">${stats.activeCount} tugas masih aktif</span>
                </div>
            </div>

            <!-- Card 2: Tugas Terlambat (Pixel Hazard Triangle / Shield) -->
            <div class="stat-metric-card ${overdueClass}">
                <div class="stat-card-icon-box ${stats.overdueCount > 0 ? 'bg-amber-subtle' : 'bg-emerald-subtle'}" title="Status Tenggat">
                    ${stats.overdueCount > 0 ? `
                        <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon">
                            <!-- Pixel Warning Triangle Frame -->
                            <path d="M7 1h2v1H7V1zm-1 1h1v1H6V2zm3 0h1v1H9V2zm-2 1h-1v1H5V3zm5 0h1v1h-1V3zm-2 1h-1v2H4V4zm7 0h1v2h-1V4zm-3 2h-1v2H3V6zm9 0h1v2h-1V6zm-4 2h-1v2H2V8zm11 0h1v2h-1V8zm-5 2h-1v2H1v-2zm13 0h1v2h-1v-2zM1 13h14v2H1v-2z"/>
                            <!-- Pixel Exclamation -->
                            <path d="M7 5h2v4H7V5zm0 5h2v2H7v-2z"/>
                        </svg>
                    ` : `
                        <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon">
                            <!-- Pixel Shield Frame -->
                            <path d="M2 1h12v2H2V1zm0 2h1v5H2V3zm11 0h1v5h-1V3zM3 8h1v1H3V8zm9 0h1v1h-1V8zm-8 1h1v1H4V9zm7 0h1v1h-1V9zm-6 1h1v1H5v-1zm5 0h1v1h-1v-1zm-4 1h1v1H6v-1zm3 0h1v1H9v-1zm-2 1h2v1H7v-1z"/>
                            <!-- Pixel Shield Checkmark -->
                            <path d="M4 6h1v2H4V6zm1 2h1v2H5V8zm1 1h1v2H6V9zm1-1h1v2H7V8zm1-1h1v2H8V7zm1-1h1v2H9V6zm1-1h1v2h-1V5z"/>
                        </svg>
                    `}
                </div>
                <div class="stat-metric-content">
                    <span class="stat-metric-label">Status Tenggat</span>
                    <div class="stat-metric-value-row">
                        <span class="stat-metric-number ${stats.overdueCount > 0 ? 'text-amber' : 'text-emerald'}">${overdueTitle}</span>
                    </div>
                    <span class="stat-metric-sub">${overdueDesc}</span>
                </div>
            </div>

            <!-- Card 3: Hari Paling Produktif (Pixel Lightning Bolt) -->
            <div class="stat-metric-card">
                <div class="stat-card-icon-box bg-purple-subtle" title="Hari Tersibuk">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon">
                        <!-- Pixel Lightning Bolt -->
                        <path d="M9 1h2v1H9V1zm-1 1h2v1H8V2zm-1 1h2v1H7V3zm-1 1h2v1H6V4zm-1 1h2v1H5V5zm-1 1h2v1H4V6zM3 7h11v2H3V7zm5 2h2v1H8V9zm-1 1h2v1H7v-1zm-1 1h2v1H6v-1zm-1 1h2v1H5v-1zm-1 1h2v1H4v-1zm-1 1h2v1H3v-1zm0 1h1v1H3v-1z"/>
                    </svg>
                </div>
                <div class="stat-metric-content">
                    <span class="stat-metric-label">Hari Tersibuk</span>
                    <div class="stat-metric-value-row">
                        <span class="stat-metric-number">${peakDayText}</span>
                    </div>
                    <span class="stat-metric-sub">${peakDaySub}</span>
                </div>
            </div>

            <!-- Card 4: Bulan Rekor (Pixel Calendar) -->
            <div class="stat-metric-card">
                <div class="stat-card-icon-box bg-indigo-subtle" title="Bulan Paling Produktif">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon">
                        <!-- Binder Rings -->
                        <path d="M4 1h2v3H4V1zm6 0h2v3h-2V1z"/>
                        <!-- Header Bar -->
                        <path d="M2 3h12v4H2V3z"/>
                        <!-- Body Frame -->
                        <path d="M2 7h2v7H2V7zm10 0h2v7h-2V7zm-8 5h8v2H4v-2z"/>
                        <!-- Pixel Date Grid -->
                        <path d="M5 8h2v2H5V8zm4 0h2v2H9V8zm-4 3h2v2H5v-2zm4 0h2v2H9v-2z"/>
                    </svg>
                </div>
                <div class="stat-metric-content">
                    <span class="stat-metric-label">Bulan Paling Produktif</span>
                    <div class="stat-metric-value-row">
                        <span class="stat-metric-number">${peakMonthText}</span>
                    </div>
                    <span class="stat-metric-sub">${peakMonthSub}</span>
                </div>
            </div>
        </div>

        <!-- Lower Visual Insights (Weekly Activity & Streak / Focus Panel) -->
        <div class="stats-details-grid">
            <!-- Left Panel: Weekly Activity Bar Chart -->
            <div class="stat-panel-card">
                <div class="stat-panel-header">
                    <div>
                        <h4 class="stat-panel-title">
                            <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon" style="margin-right: 5px; color: var(--primary);">
                                <path d="M1 12h12v1H1v-1zm1-3h2v3H2V9zm3-4h2v7H5V5zm3-3h2v10H8V2zm3 5h2v5h-2V7z"/>
                            </svg>
                            Aktivitas 7 Hari Terakhir
                        </h4>
                        <span class="stat-panel-sub">Konsistensi penyelesaian tugas harian</span>
                    </div>
                    <span class="stat-tag-badge">Mingguan</span>
                </div>
                <div class="weekly-activity-chart">
                    ${weeklyBarsHTML}
                </div>
            </div>

            <!-- Right Panel: Motivation Streak, On-Time Score & Project Distribution -->
            <div class="stat-panel-card">
                <div class="stat-panel-header">
                    <div>
                        <h4 class="stat-panel-title">
                            <svg width="15" height="15" viewBox="0 0 14 14" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon" style="margin-right: 5px; color: #f59e0b;">
                                <path d="M5 1h4v1H5V1zm-2 2h8v1H3V3zm-1 2h10v1H2V5zm0 2h1v4h1V7h6v4h1V7h1V5H2v2zm3 2h4v2H5V9z"/>
                            </svg>
                            Fokus & Ketepatan Waktu
                        </h4>
                        <span class="stat-panel-sub">Ritme kerja & distribusi kategori</span>
                    </div>
                    <span class="streak-badge-pill ${stats.streakCount > 0 ? 'active' : ''}">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" shape-rendering="crispEdges" class="pixel-icon pixel-flame" style="margin-right: 4px; color: #ea580c;">
                            <path d="M5 1h2v2H5V1zm-2 2h2v2H3V3zm4 0h2v2H7V3zm-3 2h4v2H4V5zm-2 2h8v2H2V7zm1 2h6v2H3V9zm1 1h4v1H4v-1z"/>
                        </svg>
                        ${stats.streakCount} Hari Streak
                    </span>
                </div>
                
                <div class="on-time-highlight-row">
                    <div class="on-time-score-box">
                        <span class="on-time-pct">${stats.onTimeRate}%</span>
                        <span class="on-time-lbl">Tepat Waktu</span>
                    </div>
                    <div class="on-time-desc-text">
                        <strong>${stats.onTimeCount} tugas</strong> diselesaikan tepat sebelum atau pada tanggal tenggat.
                    </div>
                </div>

                <div class="stat-category-breakdown-wrap">
                    <div class="stat-cat-header-label">Top Kategori Selesai:</div>
                    ${categoryBarsHTML}
                </div>
            </div>
        </div>
    `;

    // Ensure the container height doesn't get clipped when not collapsed
    const statsTable = document.getElementById('productivity-stats-content');
    if (statsTable && !statsTable.classList.contains('collapsed')) {
        statsTable.style.maxHeight = 'none';
    }
}

/**
 * Toggle collapse/expand untuk section statistik dengan animasi yang sama mulusnya
 */
function toggleProductivityStats(forceState = null, animate = true) {
    const header = document.getElementById('toggle-productivity-stats');
    const content = document.getElementById('productivity-stats-content');
    if (!header || !content) return;

    const isCurrentlyCollapsed = header.classList.contains('collapsed');
    const willCollapse = (forceState !== null) ? forceState : !isCurrentlyCollapsed;

    clearTimeout(analyticsAnimTimeout);

    if (!animate) {
        content.style.transition = 'none';
        if (willCollapse) {
            header.classList.add('collapsed');
            content.classList.add('collapsed');
            content.style.maxHeight = '0px';
        } else {
            header.classList.remove('collapsed');
            content.classList.remove('collapsed');
            content.style.maxHeight = 'none';
        }
        void content.offsetHeight;
        content.style.transition = '';
        return;
    }

    if (willCollapse) {
        content.style.maxHeight = content.scrollHeight + 'px';
        void content.offsetHeight;
        header.classList.add('collapsed');
        content.classList.add('collapsed');
        content.style.maxHeight = '0px';
    } else {
        header.classList.remove('collapsed');
        content.classList.remove('collapsed');
        content.style.maxHeight = content.scrollHeight + 'px';
        analyticsAnimTimeout = setTimeout(() => {
            if (!content.classList.contains('collapsed')) {
                content.style.maxHeight = 'none';
            }
        }, 380);
    }
}

/**
 * Inisialisasi event listener untuk section analytics
 */
function initProductivityStats() {
    const header = document.getElementById('toggle-productivity-stats');
    if (header) {
        header.addEventListener('click', () => {
            const isCurrentlyCollapsed = header.classList.contains('collapsed');
            const newState = !isCurrentlyCollapsed;
            toggleProductivityStats(newState, true);
            localStorage.setItem('taskmaster_analytics_collapsed', newState);
        });

        // Restore saved preference
        const savedCollapsed = localStorage.getItem('taskmaster_analytics_collapsed') === 'true';
        toggleProductivityStats(savedCollapsed, false);
    }

    renderProductivityStats();
}

function escapeHTMLSafe(str) {
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

// Global exposure for integration with app.js
window.renderProductivityStats = renderProductivityStats;
window.initProductivityStats = initProductivityStats;
window.toggleProductivityStats = toggleProductivityStats;
