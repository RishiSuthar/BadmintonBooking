const SUPABASE_URL = 'https://wezgcqbagksqxyugqqad.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemdjcWJhZ2tzcXh5dWdxcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTUxNjksImV4cCI6MjA2ODY3MTE2OX0.AXnI7UgvWhnnAdZ5V9WGucdI4T-z2vTVAuRBU0R9qKQ';

// Check if supabase is defined
if (typeof supabase === 'undefined') {
    createModal('error', 'Failed to initialize the application. Please check your internet connection and try again.');
    throw new Error('Supabase client is not defined');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const calendarEl = document.getElementById('calendar');
const timeSlotsEl = document.getElementById('time-slots');
const bookingsListEl = document.getElementById('bookings-list');
const userBookingsListEl = document.getElementById('user-bookings-list');
const bookBtn = document.getElementById('book-btn');
const successMessage = document.getElementById('success-message');
const receiptMessage = document.getElementById('receipt-message');
const currentYearEl = document.getElementById('current-year');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginFormElement = document.getElementById('login-form-element');
const registerFormElement = document.getElementById('register-form-element');
const mainContent = document.getElementById('main-content');
const bookingPanel = document.getElementById('booking-panel');
const userPanel = document.getElementById('user-panel');
const profileName = document.getElementById('profile-name');
const profilePhone = document.getElementById('profile-phone');
const updateProfileBtn = document.getElementById('update-profile-btn');

// Selected booking details
let selectedDate = null;
let selectedTime = null;
let userProfile = null;

// Modal creation function
function createModal(type, message, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 0.5rem;
        max-width: 400px;
        width: 90%;
        text-align: center;
    `;

    let htmlContent = '';
    if (type === 'error') {
        htmlContent = `
            <h3 style="color: #e74c3c; margin-bottom: 1rem;">Note</h3>
            <p>${message}</p>
            <button class="auth-btn" style="margin-top: 1rem;" onclick="this.closest('.modal').remove()">OK</button>
        `;
    } else if (type === 'confirm') {
        htmlContent = `
            <h3 style="margin-bottom: 1rem;">Confirm</h3>
            <p>${message}</p>
            <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
                <button class="auth-btn confirm-yes">Yes</button>
                <button class="auth-btn confirm-no">No</button>
            </div>
        `;
    } else if (type === 'prompt') {
        htmlContent = `
            <h3 style="margin-bottom: 1rem;">Update Profile</h3>
            <form id="profile-update-form">
                <input type="text" id="modal-name" placeholder="Name" value="${message.name || ''}" style="margin-bottom: 0.5rem; width: 100%;" required>
                <input type="tel" id="modal-phone" placeholder="Phone Number" value="${message.phone || ''}" style="margin-bottom: 0.5rem; width: 100%;" required>
                <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
                    <button type="submit" class="auth-btn">Submit</button>
                    <button type="button" class="auth-btn cancel" onclick="this.closest('.modal').remove()">Cancel</button>
                </div>
            </form>
        `;
    }

    modalContent.innerHTML = htmlContent;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    if (type === 'confirm') {
        modalContent.querySelector('.confirm-yes').addEventListener('click', () => {
            modal.remove();
            callback(true);
        });
        modalContent.querySelector('.confirm-no').addEventListener('click', () => {
            modal.remove();
            callback(false);
        });
    } else if (type === 'prompt') {
        modalContent.querySelector('#profile-update-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = modalContent.querySelector('#modal-name').value.trim();
            const phone = modalContent.querySelector('#modal-phone').value.trim();
            modal.remove();
            callback({ name, phone });
        });
    }
}

// Initialize the application
async function init() {
    currentYearEl.textContent = new Date().getFullYear();
    await checkAuthStatus();
    loginBtn.addEventListener('click', () => toggleForm('login'));
    registerBtn.addEventListener('click', () => toggleForm('register'));
    logoutBtn.addEventListener('click', handleLogout);
    loginFormElement.addEventListener('submit', handleLogin);
    registerFormElement.addEventListener('submit', handleRegister);
    bookBtn.addEventListener('click', handleBooking);
    updateProfileBtn.addEventListener('click', handleUpdateProfile);
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) {
            if (error.name === 'AuthSessionMissingError') {
                showGuestInterface();
                generateCalendar();
                await loadBookingsForDate(getTodayDate());
                return;
            }
            throw error;
        }
        if (user) {
            await loadUserProfile(user.id);
            showUserInterface();
            generateCalendar();
            await loadBookingsForDate(getTodayDate());
            await loadUserBookings();
        } else {
            showGuestInterface();
            generateCalendar();
            await loadBookingsForDate(getTodayDate());
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        createModal('error', 'Failed to check authentication status. Please try again.');
    }
}

// Show guest interface (login/register)
function showGuestInterface() {
    loginBtn.style.display = 'inline-block';
    registerBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    bookingPanel.style.display = 'block';
    userPanel.style.display = 'none';
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
}

// Show user interface (booking + dashboard)
function showUserInterface() {
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    bookingPanel.style.display = 'block';
    userPanel.style.display = 'block';
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    if (userProfile) {
        profileName.textContent = userProfile.name;
        profilePhone.textContent = userProfile.phone;
    }
}

// Toggle login/register form
function toggleForm(formType) {
    loginForm.style.display = formType === 'login' ? 'block' : 'none';
    registerForm.style.display = formType === 'register' ? 'block' : 'none';
    bookingPanel.style.display = formType === 'none' ? 'block' : 'none';
    userPanel.style.display = formType === 'none' && userProfile ? 'block' : 'none';
}

// Load user profile
async function loadUserProfile(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) {
            if (error.code === 'PGRST116') {
                const { data: { user } } = await supabaseClient.auth.getUser();
                let name = user.user_metadata?.name || 'New User';
                let phone = user.user_metadata?.phone || '';
                
                return new Promise((resolve) => {
                    createModal('prompt', { name, phone }, async (result) => {
                        if (result && result.name && result.phone) {
                            const { error: insertError } = await supabaseClient
                                .from('profiles')
                                .insert({ id: userId, name: result.name, phone: result.phone })
                                .select()
                                .single();
                            if (insertError) throw insertError;
                            userProfile = { id: userId, name: result.name, phone: result.phone };
                            resolve();
                        } else {
                            throw new Error('Profile creation cancelled');
                        }
                    });
                });
            } else {
                throw error;
            }
        } else {
            userProfile = data;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        createModal('error', 'Failed to load or create profile. Please try again.');
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        await loadUserProfile(user.id);
        showUserInterface();
        generateCalendar();
        await loadBookingsForDate(getTodayDate());
        await loadUserBookings();
    } catch (error) {
        console.error('Login error:', error);
        createModal('error', `Login failed: ${error.message}`);
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    
    try {
        const { data: { user }, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    phone
                }
            }
        });
        if (error) throw error;
        
        createModal('error', 'Registration successful! Please check your email to confirm your account.');
        toggleForm('login');
    } catch (error) {
        console.error('Registration error:', error);
        createModal('error', `Registration failed: ${error.message}`);
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        userProfile = null;
        selectedDate = null;
        selectedTime = null;
        showGuestInterface();
        calendarEl.innerHTML = '';
        timeSlotsEl.innerHTML = '';
        bookingsListEl.innerHTML = '';
        userBookingsListEl.innerHTML = '';
    } catch (error) {
        console.error('Logout error:', error);
        createModal('error', `Logout failed: ${error.message}`);
    }
}

// Handle profile update
async function handleUpdateProfile() {
    createModal('prompt', { name: userProfile.name, phone: userProfile.phone }, async (result) => {
        if (result && result.name && result.phone) {
            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ name: result.name, phone: result.phone })
                    .eq('id', userProfile.id);
                if (error) throw error;
                
                userProfile.name = result.name;
                userProfile.phone = result.phone;
                profileName.textContent = userProfile.name;
                profilePhone.textContent = userProfile.phone;
                createModal('error', 'Profile updated successfully!');
            } catch (error) {
                console.error('Profile update error:', error);
                createModal('error', `Profile update failed: ${error.message}`);
            }
        }
    });
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    return formatDate(today);
}

// Format date as YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Load bookings for a specific date
async function loadBookingsForDate(date) {
    try {
        showLoading(bookingsListEl, 'Loading bookings...');
        const { data: bookings, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('date', date);
        
        if (error) throw error;
        
        displayBookings(bookings);
        generateTimeSlots(bookings);
        selectDateOnCalendar(date);
    } catch (error) {
        console.error('Fetch error:', error);
        showError(bookingsListEl, `Failed to load bookings: ${error.message}. Please try again.`);
    }
}

// Load user's bookings
async function loadUserBookings() {
    if (!userProfile) return;
    try {
        showLoading(userBookingsListEl, 'Loading your bookings...');
        const { data: bookings, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('date', { ascending: true })
            .order('time', { ascending: true });
        
        if (error) throw error;
        
        displayUserBookings(bookings);
    } catch (error) {
        console.error('Fetch error:', error);
        showError(userBookingsListEl, `Failed to load your bookings: ${error.message}. Please try again.`);
    }
}

// Generate calendar for 14 days
function generateCalendar() {
    calendarEl.innerHTML = '';
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        
        const day = document.createElement('div');
        day.className = 'day';
        if (i === 0) day.classList.add('today');
        
        day.innerHTML = `
            <div>${days[date.getDay()]}</div>
            <div>${date.getDate()}</div>
            <div>${date.toLocaleString('default', { month: 'short' })}</div>
        `;
        
        day.dataset.date = formatDate(date);
        day.addEventListener('click', async () => {
            selectedDate = day.dataset.date;
            await loadBookingsForDate(selectedDate);
            updateBookingSummary();
        });
        
        calendarEl.appendChild(day);
    }
}

// Select date on calendar
function selectDateOnCalendar(date) {
    document.querySelectorAll('.day').forEach(day => {
        day.classList.remove('selected');
        if (day.dataset.date === date) {
            day.classList.add('selected');
        }
    });
}

// Generate time slots from 6:30 PM to 9:30 PM
function generateTimeSlots(bookings) {
    timeSlotsEl.innerHTML = '';
    const timeSlots = ['18:30', '19:30', '20:30', '21:30'];
    
    timeSlots.forEach(time => {
        const isBooked = bookings.some(b => b.time === time);
        
        const slot = document.createElement('div');
        slot.className = 'slot';
        
        if (isBooked) {
            slot.classList.add('booked');
            slot.textContent = `${formatTime(time)} - Booked`;
        } else {
            slot.classList.add('available');
            slot.textContent = `${formatTime(time)} - Available`;
            slot.addEventListener('click', () => {
                document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
                selectedTime = time;
                updateBookingSummary();
            });
        }
        
        timeSlotsEl.appendChild(slot);
    });
}

// Format time as 12-hour with AM/PM
function formatTime(time) {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Display bookings
// Display bookings
async function displayBookings(bookings) {
    bookingsListEl.innerHTML = '';
    
    if (bookings.length === 0) {
        bookingsListEl.innerHTML = '<p>No bookings for this date yet</p>';
        return;
    }
    
    bookings.sort((a, b) => a.time.localeCompare(b.time));
    
    // Get all user profiles at once for efficiency
    const userIds = bookings.map(b => b.user_id);
    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
    
    if (error) {
        console.error('Error fetching users:', error);
        showError(bookingsListEl, 'Failed to load booking details.');
        return;
    }
    
    // Create a map of user IDs to names
    const userMap = new Map();
    users.forEach(user => userMap.set(user.id, user.name));
    
    for (const booking of bookings) {
        const bookingEl = document.createElement('div');
        bookingEl.className = 'booking-item';
        
        const userName = userMap.get(booking.user_id) || 'Unknown';
        const isCurrentUser = userProfile && booking.user_id === userProfile.id;
        
        bookingEl.innerHTML = `
            <h4>${isCurrentUser ? 'You' : `Booked by ${userName}`}</h4>
            <p>${formatTime(booking.time)} - 1 Hour</p>
        `;
        bookingsListEl.appendChild(bookingEl);
    }
}
// Display user's bookings with cancel/modify options
function displayUserBookings(bookings) {
    userBookingsListEl.innerHTML = '';
    
    if (bookings.length === 0) {
        userBookingsListEl.innerHTML = '<p>You have no bookings yet</p>';
        return;
    }
    
    bookings.forEach(booking => {
        const bookingEl = document.createElement('div');
        bookingEl.className = 'booking-item';
        bookingEl.innerHTML = `
            <h4>${booking.date}</h4>
            <p>${formatTime(booking.time)} - 1 Hour</p>
            <p>Status: ${booking.status}</p>
            <button class="cancel-btn" data-id="${booking.id}">Cancel Booking</button>
            <button class="modify-btn" data-id="${booking.id}" data-date="${booking.date}" data-time="${booking.time}">Modify Booking</button>
        `;
        userBookingsListEl.appendChild(bookingEl);
    });
    
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => handleCancelBooking(btn.dataset.id));
    });
    
    document.querySelectorAll('.modify-btn').forEach(btn => {
        btn.addEventListener('click', () => handleModifyBooking(btn.dataset.id, btn.dataset.date, btn.dataset.time));
    });
}

// Update booking summary
function updateBookingSummary() {
    document.getElementById('summary-date').textContent = 
        `Date: ${selectedDate || 'Not selected'}`;
    document.getElementById('summary-time').textContent = 
        `Time: ${selectedTime ? formatTime(selectedTime) : 'Not selected'}`;
}

// Handle booking submission
async function handleBooking() {
    if (!userProfile) {
        createModal('error', 'Please log in to book a slot.');
        return;
    }
    
    if (!selectedDate || !selectedTime) {
        createModal('error', 'Please select a date and time.');
        return;
    }
    
    const bookingData = {
        user_id: userProfile.id,
        date: selectedDate,
        time: selectedTime,
        duration: '1 Hour',
        status: 'Confirmed'
    };
    
    const originalBtnText = bookBtn.textContent;
    
    try {
        bookBtn.innerHTML = '<span class="loading"></span> Processing...';
        bookBtn.disabled = true;
        
        console.log('Sending booking data:', bookingData);
        
        const exists = await checkBookingExists(selectedDate, selectedTime);
        if (exists) {
            throw new Error('This time slot is already booked. Please choose another.');
        }
        
        const { data, error } = await supabaseClient
            .from('bookings')
            .insert(bookingData)
            .select()
            .single();
        
        if (error) throw error;
        
        successMessage.style.display = 'block';
        showReceipt(bookingData, data.id);
        await loadBookingsForDate(selectedDate);
        await loadUserBookings();
        
        selectedTime = null;
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
        updateBookingSummary();
        
        setTimeout(() => {
            successMessage.style.display = 'none';
            receiptMessage.style.display = 'none';
        }, 5000);
        
    } catch (error) {
        console.error('Booking error:', error);
        createModal('error', `Failed to save booking: ${error.message}. Please try again.`);
    } finally {
        bookBtn.textContent = originalBtnText;
        bookBtn.disabled = false;
    }
}

// Check for existing booking
async function checkBookingExists(date, time) {
    try {
        const { data: bookings, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('date', date)
            .eq('time', time);
        if (error) throw error;
        return bookings.length > 0;
    } catch (error) {
        console.error('Check booking exists error:', error);
        throw error;
    }
}

// Show confirmation receipt
function showReceipt(bookingData, bookingId) {
    receiptMessage.innerHTML = `
        <h3>Booking Confirmation</h3>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Name:</strong> ${userProfile.name}</p>
        <p><strong>Phone:</strong> ${userProfile.phone}</p>
        <p><strong>Date:</strong> ${bookingData.date}</p>
        <p><strong>Time:</strong> ${formatTime(bookingData.time)}</p>
        <p><strong>Duration:</strong> 1 Hour</p>
        <p><strong>Status:</strong> Confirmed</p>
        <p>Thank you for booking with Suthar Badminton!</p>
    `;
    receiptMessage.style.display = 'block';
}

// Handle booking cancellation
async function handleCancelBooking(bookingId) {
    createModal('confirm', 'Are you sure you want to cancel this booking?', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const { error } = await supabaseClient
                .from('bookings')
                .delete()
                .eq('id', bookingId);
            
            if (error) throw error;
            
            createModal('error', 'Booking cancelled successfully!');
            await loadBookingsForDate(selectedDate || getTodayDate());
            await loadUserBookings();
        } catch (error) {
            console.error('Cancel error:', error);
            createModal('error', `Failed to cancel booking: ${error.message}. Please try again.`);
        }
    });
}

// Handle booking modification
async function handleModifyBooking(bookingId, currentDate, currentTime) {
    if (!selectedDate || !selectedTime) {
        createModal('error', 'Please select a new date and time for the booking.');
        return;
    }
    
    if (selectedDate === currentDate && selectedTime === currentTime) {
        createModal('error', 'Please select a different date or time to modify the booking.');
        return;
    }
    
    try {
        const exists = await checkBookingExists(selectedDate, selectedTime);
        if (exists) {
            throw new Error('The selected time slot is already booked. Please choose another.');
        }
        
        const { error } = await supabaseClient
            .from('bookings')
            .update({ date: selectedDate, time: selectedTime })
            .eq('id', bookingId);
        
        if (error) throw error;
        
        createModal('error', 'Booking modified successfully!');
        await loadBookingsForDate(selectedDate || getTodayDate());
        await loadUserBookings();
        selectedTime = null;
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
        updateBookingSummary();
    } catch (error) {
        console.error('Modify error:', error);
        createModal('error', `Failed to modify booking: ${error.message}. Please try again.`);
    }
}

// Show loading state
function showLoading(element, message) {
    element.innerHTML = `<p><span class="loading"></span> ${message}</p>`;
}

// Show error message
function showError(element, message) {
    element.innerHTML = `<p class="error">${message}</p>`;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);