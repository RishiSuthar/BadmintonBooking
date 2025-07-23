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
            loadSubscriptions(),
            loadUsers(),
            loadTodaysBookings(),
            loadSystemStats()
        ]);
    } catch (error) {
        console.error('[Admin] Data loading failed:', error);
        throw error;
    }
}

async function loadSubscriptions() {
    const tableElement = document.querySelector('#subscriptions-table');
    try {
        showLoading(tableElement);
        
        // Get subscriptions with user data
        const { data: subscriptions, error } = await supabaseClient
            .from('user_subscriptions')
            .select(`
                id,
                registration_code,
                created_at,
                expires_at,
                is_active,
                user_id
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get user details for each subscription
        const subscriptionsWithUsers = await Promise.all(
            subscriptions.map(async sub => {
                if (!sub.user_id) return { ...sub, profiles: null };
                
                const { data: profile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('name, email')
                    .eq('id', sub.user_id)
                    .single();
                
                return {
                    ...sub,
                    profiles: profileError ? null : profile
                };
            })
        );

        renderSubscriptionsTable(subscriptionsWithUsers);
    } catch (error) {
        console.error('Subscriptions load error:', error);
        showError(tableElement, 'Failed to load subscriptions');
    } finally {
        hideLoading(tableElement);
    }
}

async function loadUsers() {
    const tableElement = document.querySelector('#users-table');
    try {
        showLoading(tableElement);
        
        // Get users and their subscriptions separately
        const { data: users, error: usersError } = await supabaseClient
            .from('profiles')
            .select('id, name, email, is_admin, created_at')
            .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        // Get subscriptions separately
        const { data: subscriptions, error: subsError } = await supabaseClient
            .from('user_subscriptions')
            .select('user_id, is_active, expires_at');

        if (subsError) throw subsError;

        // Combine the data
        const usersWithSubs = users.map(user => {
            const userSubs = subscriptions.filter(sub => sub.user_id === user.id);
            return {
                ...user,
                user_subscriptions: userSubs
            };
        });

        renderUsersTable(usersWithSubs);
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
            .select(`
                id,
                time,
                guest_slots,
                profiles:user_id (name, email)
            `)
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
        // Get total users count
        const { count: totalUsers } = await supabaseClient
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        
        // Get active subscriptions count
        const { count: activeSubscriptions } = await supabaseClient
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString());
        
        // Get today's bookings count
        const today = new Date().toISOString().split('T')[0];
        const { count: activeBookings } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('date', today);

        updateStatsUI({
            total_users: totalUsers || 0,
            active_subscriptions: activeSubscriptions || 0,
            active_bookings: activeBookings || 0
        });
    } catch (error) {
        console.error('Stats load error:', error);
        updateStatsUI({ 
            total_users: 0, 
            active_subscriptions: 0,
            active_bookings: 0 
        });
    }
}

// Rendering Functions
function renderSubscriptionsTable(subscriptions) {
    const tbody = document.querySelector('#subscriptions-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = subscriptions.map(sub => {
        const now = new Date();
        const expiresAt = new Date(sub.expires_at);
        const isExpired = expiresAt < now;
        const statusClass = !sub.is_active ? 'inactive' : isExpired ? 'expired' : 'active';
        const statusText = !sub.is_active ? 'Inactive' : isExpired ? 'Expired' : 'Active';
        
        return `
            <tr>
                <td><code>${sub.registration_code}</code></td>
                <td>
                    ${sub.profiles ? 
                        `${sub.profiles.name || 'No name'} (${sub.profiles.email || 'No email'})` : 
                        'Unassigned'}
                </td>
                <td>${formatDate(sub.created_at)}</td>
                <td>${formatDate(sub.expires_at)}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn-action ${sub.is_active ? 'btn-demote' : 'btn-promote'}" 
                            data-sub-id="${sub.id}"
                            data-is-active="${sub.is_active}">
                        ${sub.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.btn-promote, .btn-demote').forEach(btn => {
        btn.addEventListener('click', handleSubscriptionToggle);
    });
}

function renderUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => {
        const hasActiveSub = user.user_subscriptions && user.user_subscriptions.some(
            sub => sub.is_active && new Date(sub.expires_at) > new Date()
        );
        
        return `
            <tr>
                <td>${user.name || 'Unknown'}</td>
                <td>${user.email || ''}</td>
                <td>
                    <span class="status-badge ${user.is_admin ? 'admin' : 'user'}">
                        ${user.is_admin ? 'ADMIN' : 'USER'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${hasActiveSub ? 'active' : 'inactive'}">
                        ${hasActiveSub ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn-action ${user.is_admin ? 'btn-demote' : 'btn-promote'}" 
                            data-user-id="${user.id}">
                        ${user.is_admin ? 'Demote' : 'Promote'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

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
    const activeSubsEl = document.getElementById('active-subscriptions');
    const activeBookingsEl = document.getElementById('active-bookings');
    
    if (totalUsersEl) totalUsersEl.textContent = stats.total_users;
    if (activeSubsEl) activeSubsEl.textContent = stats.active_subscriptions;
    if (activeBookingsEl) activeBookingsEl.textContent = stats.active_bookings;
}

// Event Handlers
async function generateRegistrationCode() {
    try {
        // Generate a random 8-character alphanumeric code
        const code = generateRandomCode(8);
        
        // Set expiration date to 30 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        const { data, error } = await supabaseClient
            .from('user_subscriptions')
            .insert({
                registration_code: code,
                expires_at: expiresAt.toISOString(),
                is_active: true
            })
            .select()
            .single();
            
        if (error) throw error;
        
        showToast(`Generated new code: ${code}`);
        
        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(code);
            showToast('Code copied to clipboard!');
        } catch (clipboardError) {
            console.error('Clipboard error:', clipboardError);
        }
        
        await loadSubscriptions();
        
    } catch (error) {
        console.error('Code generation error:', error);
        showToast('Failed to generate code', true);
    }
}

function generateRandomCode(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function handleSubscriptionToggle(event) {
    const button = event.currentTarget;
    const subId = button.dataset.subId;
    const isActive = button.dataset.isActive === 'true';
    
    try {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Processing...';
        
        const { error } = await supabaseClient
            .from('user_subscriptions')
            .update({ is_active: !isActive })
            .eq('id', subId);

        if (error) throw error;
        
        showToast(`Subscription ${isActive ? 'deactivated' : 'activated'}`);
        await loadSubscriptions();
    } catch (error) {
        showToast('Operation failed', true);
        console.error('Subscription toggle error:', error);
    }
}

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
        
        showToast(`User ${makeAdmin ? 'promoted to admin' : 'demoted to user'}`);
        await loadUsers();
    } catch (error) {
        showToast('Operation failed', true);
        console.error('Role change error:', error);
    }
}

async function handleCancelBooking(event) {
    const bookingId = event.currentTarget.dataset.bookingId;
    
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
        event.currentTarget.disabled = true;
        event.currentTarget.innerHTML = '<span class="spinner"></span> Processing...';
        
        const { error } = await supabaseClient
            .from('bookings')
            .delete()
            .eq('id', bookingId);

        if (error) throw error;
        
        showToast('Booking cancelled successfully');
        await loadTodaysBookings();
    } catch (error) {
        showToast('Cancellation failed', true);
        console.error('Cancel booking error:', error);
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('logout-btn').addEventListener('click', () => {
        supabaseClient.auth.signOut().then(() => {
            redirectToLogin();
        });
    });

    // Refresh controls
    document.getElementById('refresh-users').addEventListener('click', loadUsers);
    document.getElementById('refresh-bookings').addEventListener('click', loadTodaysBookings);
    document.getElementById('view-subscriptions-btn').addEventListener('click', loadSubscriptions);
    
    // Generate code button
    document.getElementById('generate-code-btn').addEventListener('click', generateRegistrationCode);
}

// Utility Functions
function showLoading(element) {
    // Handle both selector strings and DOM elements
    if (typeof element === 'string') {
        element = document.querySelector(element);
    }
    
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
    // Handle both selector strings and DOM elements
    if (typeof element === 'string') {
        element = document.querySelector(element);
    }
    
    if (element) element.classList.remove('loading');
}

function showError(element, message) {
    // Handle both selector strings and DOM elements
    if (typeof element === 'string') {
        element = document.querySelector(element);
    }
    
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
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(toast => toast.remove());
    
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
    return `${hours12}:${minutes.padStart(2, '0')} ${period}`;
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function redirectToLogin() {
    window.location.href = 'index.html';
}