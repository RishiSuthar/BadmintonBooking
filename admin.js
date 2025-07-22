document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase client with your preferred name
    const supabaseClient = supabase.createClient(
        'https://wezgcqbagksqxyugqqad.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemdjcWJhZ2tzcXh5dWdxcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTUxNjksImV4cCI6MjA2ODY3MTE2OX0.AXnI7UgvWhnnAdZ5V9WGucdI4T-z2vTVAuRBU0R9qKQ'
    );

    try {
        console.log('[Admin] Initializing...');
        
        // 1. Verify Authentication
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        
        if (authError || !user) {
            console.warn('[Admin] Authentication failed');
            return redirectToLogin();
        }

        // 2. Verify Admin Status
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('is_admin, name')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.is_admin) {
            console.warn(`[Admin] Access denied for ${user.email}`);
            alert('🔒 Admin privileges required');
            return redirectToLogin();
        }

        // 3. Admin Access Granted
        console.log(`[Admin] ${profile.name} authenticated successfully`);
        document.getElementById('admin-greeting').textContent = `Welcome, ${profile.name}`;
        
        // 4. Load Data
        await loadData();
        setupEventListeners();

    } catch (error) {
        console.error('[Admin] Critical error:', error);
        alert('⚠️ System error. Please try again.');
        redirectToLogin();
    }

    // ==================== Core Functions ====================

    async function loadData() {
        try {
            await Promise.all([
                loadUsers(),
                loadTodaysBookings(),
                loadSystemStats()
            ]);
        } catch (error) {
            console.error('[Admin] Data loading failed:', error);
        }
    }

    async function loadUsers() {
        try {
            showLoading('#users-table');
            
            const { data: users, error } = await supabaseClient
                .from('profiles')
                .select('id, name, email, is_admin, last_sign_in_at')
                .order('created_at', { ascending: false });

            if (error) throw error;

            renderUsersTable(users);
        } catch (error) {
            showError('#users-table', 'Failed to load users');
            console.error('[Admin] User load error:', error);
        }
    }

    async function loadTodaysBookings() {
        try {
            showLoading('#bookings-table');
            
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
            showError('#bookings-table', 'Failed to load bookings');
            console.error('[Admin] Bookings load error:', error);
        }
    }

    async function loadSystemStats() {
        try {
            const { data: stats } = await supabaseClient
                .rpc('get_admin_stats');
            
            document.getElementById('total-users').textContent = stats.total_users;
            document.getElementById('active-bookings').textContent = stats.active_bookings;
        } catch (error) {
            console.error('[Admin] Stats load error:', error);
        }
    }

    // ==================== Render Functions ====================

    function renderUsersTable(users) {
        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td class="role-cell">
                    <span class="role-badge ${user.is_admin ? 'admin' : 'user'}">
                        ${user.is_admin ? 'ADMIN' : 'USER'}
                    </span>
                </td>
                <td>${formatDate(user.last_sign_in_at)}</td>
                <td class="actions">
                    <button class="btn-action ${user.is_admin ? 'btn-demote' : 'btn-promote'}" 
                            data-user-id="${user.id}">
                        ${user.is_admin ? 'Demote' : 'Promote'}
                    </button>
                </td>
            </tr>
        `).join('');

        // Add event listeners
        document.querySelectorAll('.btn-promote, .btn-demote').forEach(btn => {
            btn.addEventListener('click', handleAdminToggle);
        });
    }

    function renderBookingsTable(bookings) {
        const tbody = document.querySelector('#bookings-table tbody');
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
                <td class="actions">
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

    // ==================== Event Handlers ====================

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
            console.error('[Admin] Role change error:', error);
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
            console.error('[Admin] Cancel booking error:', error);
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
    }

    // ==================== UI Utilities ====================

    function showLoading(selector) {
        const element = document.querySelector(selector);
        element.classList.add('loading');
        element.querySelector('tbody').innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="loading-spinner">Loading data...</div>
                </td>
            </tr>`;
    }

    function showError(selector, message) {
        const element = document.querySelector(selector);
        element.classList.remove('loading');
        element.querySelector('tbody').innerHTML = `
            <tr>
                <td colspan="5" class="error-message">
                    ${message}
                </td>
            </tr>`;
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
});