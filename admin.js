// Initialize Supabase client
const supabaseClient = supabase.createClient(
    'https://wezgcqbagksqxyugqqad.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemdjcWJhZ2tzcXh5dWdxcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTUxNjksImV4cCI6MjA2ODY3MTE2OX0.AXnI7UgvWhnnAdZ5V9WGucdI4T-z2vTVAuRBU0R9qKQ'
);

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('[Admin] Initializing...');
        
        // 1. Verify Authentication
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) throw new Error('Authentication failed');

        // 2. Verify Admin Status
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('is_admin, name')
            .eq('id', user.id)
            .single();
        if (profileError || !profile?.is_admin) throw new Error('Admin privileges required');

        // 3. Update UI
        updateGreeting(profile.name);
        
        // 4. Load Data
        await loadData();
        setupEventListeners();

    } catch (error) {
        console.error('[Admin] Initialization error:', error);
        showToast(`Error: ${error.message}`, true);
        setTimeout(redirectToLogin, 2000);
    }
});

// UI Functions
function updateGreeting(name) {
    const el = document.getElementById('admin-greeting');
    if (el) el.textContent = `Welcome, ${name}`;
}

async function loadData() {
    try {
        await Promise.all([
            loadUsers(),
            loadTodaysBookings(),
            loadSystemStats()
        ]);
    } catch (error) {
        console.error('[Admin] Data loading failed:', error);
        throw error;
    }
}

// Data Loading Functions
async function loadUsers() {
    const tableElement = document.querySelector('#users-table');
    try {
        showLoading(tableElement);
        
        const { data: users, error } = await supabaseClient
            .from('profiles')
            .select('id, name, email, is_admin, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderUsersTable(users);
    } catch (error) {
        console.error('User load error:', error);
        showError(tableElement, 'Failed to load users');
    } finally {
        hideLoading(tableElement);
    }
}

async function loadTodaysBookings() {
    const tableElement = document.querySelector('#bookings-table');
    try {
        showLoading(tableElement);
        
        const today = new Date().toISOString().split('T')[0];
        const { data: bookings, error } = await supabaseClient
            .from('bookings')
            .select('id, time, guest_slots, profiles:user_id (name, email)')
            .eq('date', today)
            .order('time');

        if (error) throw error;
        renderBookingsTable(bookings);
    } catch (error) {
        console.error('Bookings load error:', error);
        showError(tableElement, 'Failed to load bookings');
    } finally {
        hideLoading(tableElement);
    }
}

async function loadSystemStats() {
    try {
        // Alternative implementation without RPC function
        const { count: totalUsers } = await supabaseClient
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        
        const today = new Date().toISOString().split('T')[0];
        const { count: activeBookings } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('date', today);

        updateStatsUI({
            total_users: totalUsers || 0,
            active_bookings: activeBookings || 0
        });
    } catch (error) {
        console.error('Stats load error:', error);
        updateStatsUI({ total_users: 0, active_bookings: 0 });
    }
}

// Rendering Functions
function renderUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.name || 'Unknown'}</td>
            <td>${user.email || ''}</td>
            <td class="role-badge ${user.is_admin ? 'admin' : 'user'}">
                ${user.is_admin ? 'ADMIN' : 'USER'}
            </td>
            <td>${user.created_at ? formatDate(user.created_at) : 'Unknown'}</td>
            <td>
                <button class="btn-action ${user.is_admin ? 'btn-demote' : 'btn-promote'}" 
                        data-user-id="${user.id}">
                    ${user.is_admin ? 'Demote' : 'Promote'}
                </button>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.btn-promote, .btn-demote').forEach(btn => {
        btn.addEventListener('click', handleAdminToggle);
    });
}

function renderBookingsTable(bookings) {
    const tbody = document.querySelector('#bookings-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = bookings.map(booking => `
        <tr>
            <td>${formatTime(booking.time)}</td>
            <td>
                <div class="user-info">
                    <div>${booking.profiles?.name || 'Guest'}</div>
                    <small>${booking.profiles?.email || ''}</small>
                </div>
            </td>
            <td>${booking.guest_slots || 0}</td>
            <td>
                <button class="btn-action btn-cancel" 
                        data-booking-id="${booking.id}">
                    Cancel
                </button>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.addEventListener('click', handleCancelBooking);
    });
}

function updateStatsUI(stats) {
    const totalUsersEl = document.getElementById('total-users');
    const activeBookingsEl = document.getElementById('active-bookings');
    
    if (totalUsersEl) totalUsersEl.textContent = stats.total_users;
    if (activeBookingsEl) activeBookingsEl.textContent = stats.active_bookings;
}

// Event Handlers
async function handleAdminToggle(event) {
    const button = event.currentTarget;
    const userId = button.dataset.userId;
    const makeAdmin = button.classList.contains('btn-promote');
    
    try {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Processing...';
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ is_admin: makeAdmin })
            .eq('id', userId);

        if (error) throw error;
        
        showToast(`User ${makeAdmin ? 'promoted' : 'demoted'} successfully`);
        await loadUsers();
    } catch (error) {
        showToast('Operation failed', true);
        console.error('Role change error:', error);
    }
}

async function handleCancelBooking(event) {
    const bookingId = event.currentTarget.dataset.bookingId;
    if (!confirm('Cancel this booking?')) return;
    
    try {
        event.currentTarget.disabled = true;
        
        const { error } = await supabaseClient
            .from('bookings')
            .delete()
            .eq('id', bookingId);

        if (error) throw error;
        
        showToast('Booking cancelled');
        await loadTodaysBookings();
    } catch (error) {
        showToast('Cancellation failed', true);
        console.error('Cancel booking error:', error);
    }
}

function setupEventListeners() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        supabaseClient.auth.signOut().then(redirectToLogin);
    });
    document.getElementById('refresh-users').addEventListener('click', loadUsers);
    document.getElementById('refresh-bookings').addEventListener('click', loadTodaysBookings);
}

// Utility Functions
function showLoading(element) {
    if (!element) return;
    element.classList.add('loading');
    const tbody = element.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="100%" class="loading-row">
                    <div class="loading-spinner"></div>
                    Loading data...
                </td>
            </tr>`;
    }
}

function hideLoading(element) {
    if (!element) return;
    element.classList.remove('loading');
}

function showError(element, message) {
    if (!element) return;
    const tbody = element.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="100%" class="error-row">
                    <i class="fas fa-exclamation-circle"></i>
                    ${message}
                </td>
            </tr>`;
    }
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : 'success'}`;
    toast.innerHTML = `
        <span class="icon">${isError ? '⚠️' : '✓'}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes} ${period}`;
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
}

function redirectToLogin() {
    window.location.href = 'index.html';
}