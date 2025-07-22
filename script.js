const SUPABASE_URL = 'https://wezgcqbagksqxyugqqad.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemdjcWJhZ2tzcXh5dWdxcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTUxNjksImV4cCI6MjA2ODY3MTE2OX0.AXnI7UgvWhnnAdZ5V9WGucdI4T-z2vTVAuRBU0R9qKQ';

// Check if supabase is defined
if (typeof supabase === 'undefined') {
    console.error('Supabase client is not loaded. Ensure the Supabase CDN is included and loaded correctly.');
    alert('Failed to initialize the application. Please check your internet connection and try again.');
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
        showGuestInterface();
        generateCalendar();
        await loadBookingsForDate(getTodayDate());
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
                if (user.user_metadata) {
                    const { error: insertError } = await supabaseClient
                        .from('profiles')
                        .insert({ 
                            id: userId, 
                            name: user.user_metadata.name || 'New User',
                            phone: user.user_metadata.phone || ''
                        })
                        .select()
                        .single();
                    if (insertError) throw insertError;
                    userProfile = { id: userId, name: user.user_metadata.name, phone: user.user_metadata.phone };
                } else {
                    const name = prompt('Please enter your name:') || 'New User';
                    const phone = prompt('Please enter your phone number:') || '';
                    const { error: insertError } = await supabaseClient
                        .from('profiles')
                        .insert({ id: userId, name, phone })
                        .select()
                        .single();
                    if (insertError) throw insertError;
                    userProfile = { id: userId, name, phone };
                }
            } else {
                throw error;
            }
        } else {
            userProfile = data;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load or create profile. Please try again.');
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
        alert(`Login failed: ${error.message}`);
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
        
        alert('Registration successful! Please check your email to confirm your account.');
        toggleForm('login');
    } catch (error) {
        console.error('Registration error:', error);
        alert(`Registration failed: ${error.message}`);
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
        alert(`Logout failed: ${error.message}`);
    }
}

// Handle profile update
async function handleUpdateProfile() {
    const newName = prompt('Enter your name:', userProfile.name);
    const newPhone = prompt('Enter your phone number:', userProfile.phone);
    
    if (newName && newPhone) {
        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ name: newName.trim(), phone: newPhone.trim() })
                .eq('id', userProfile.id);
            if (error) throw error;
            
            userProfile.name = newName.trim();
            userProfile.phone = newPhone.trim();
            profile___text_content___ = userProfile.name;
            profilePhone.textContent = userProfile.phone;
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Profile update error:', error);
            alert(`Profile update failed: ${error.message}`);
        }
    }
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
async function displayBookings(bookings) {
    bookingsListEl.innerHTML = '';
    
    if (bookings.length === 0) {
        bookingsListEl.innerHTML = '<p>No bookings for this date yet</p>';
        return;
    }
    
    bookings.sort((a, b) => a.time.localeCompare(b.time));
    
    for (const booking of bookings) {
        try {
            const { data: user } = await supabaseClient.from('profiles').select('name').eq('id', booking.user_id).single();
            const bookingEl = document.createElement('div');
            bookingEl.className = 'booking-item';
            bookingEl.innerHTML = `
                <h4>${user ? (booking.user_id === userProfile?.id ? 'You' : `Booked by ${user.name}`) : 'Unknown'}</h4>
                <p>${formatTime(booking.time)} - 1 Hour</p>
            `;
            bookingsListEl.appendChild(bookingEl);
        } catch (error) {
            console.error('Error fetching user for booking:', error);
        }
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
        alert('Please log in to book a slot.');
        return;
    }
    
    if (!selectedDate || !selectedTime) {
        alert('Please select a date and time.');
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
        alert(`Failed to save booking: ${error.message}. Please try again.`);
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
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('bookings')
            .delete()
            .eq('id', bookingId);
        
        if (error) throw error;
        
        alert('Booking cancelled successfully!');
        await loadBookingsForDate(selectedDate || getTodayDate());
        await loadUserBookings();
    } catch (error) {
        console.error('Cancel error:', error);
        alert(`Failed to cancel booking: ${error.message}. Please try again.`);
    }
}

// Handle booking modification
async function handleModifyBooking(bookingId, currentDate, currentTime) {
    if (!selectedDate || !selectedTime) {
        alert('Please select a new date and time for the booking.');
        return;
    }
    
    if (selectedDate === currentDate && selectedTime === currentTime) {
        alert('Please select a different date or time to modify the booking.');
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
        
        alert('Booking modified successfully!');
        await loadBookingsForDate(selectedDate || getTodayDate());
        await loadUserBookings();
        selectedTime = null;
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
        updateBookingSummary();
    } catch (error) {
        console.error('Modify error:', error);
        alert(`Failed to modify booking: ${error.message}. Please try again.`);
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