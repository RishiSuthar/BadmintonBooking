// Supabase Configuration
const API_URL = 'https://wezgcqbagksqxyugqqad.supabase.co/rest/v1/bookings';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemdjcWJhZ2tzcXh5dWdxcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTUxNjksImV4cCI6MjA2ODY3MTE2OX0.AXnI7UgvWhnnAdZ5V9WGucdI4T-z2vTVAuRBU0R9qKQ';

// DOM Elements
const calendarEl = document.getElementById('calendar');
const timeSlotsEl = document.getElementById('time-slots');
const bookingsListEl = document.getElementById('bookings-list');
const bookBtn = document.getElementById('book-btn');
const successMessage = document.getElementById('success-message');
const receiptMessage = document.getElementById('receipt-message');
const currentYearEl = document.getElementById('current-year');

// Selected booking details
let selectedDate = null;
let selectedTime = null;

// Initialize the application
async function init() {
    currentYearEl.textContent = new Date().getFullYear();
    generateCalendar();
    await loadBookingsForDate(getTodayDate());
    bookBtn.addEventListener('click', handleBooking);
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
        const response = await fetch(`${API_URL}?date=eq.${date}&select=*`, {
            method: 'GET',
            headers: {
                'Apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const bookings = await response.json();
        displayBookings(bookings);
        generateTimeSlots(bookings);
        selectDateOnCalendar(date);
    } catch (error) {
        console.error('Fetch error:', error);
        showError(bookingsListEl, `Failed to load bookings: ${error.message}. Please try again.`);
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

// Generate time slots for currently selected date
async function generateTimeSlotsForSelectedDate() {
    if (!selectedDate) return;
    
    try {
        const response = await fetch(`${API_URL}?date=eq.${selectedDate}&select=*`, {
            method: 'GET',
            headers: {
                'Apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const bookings = await response.json();
        generateTimeSlots(bookings);
    } catch (error) {
        console.error('Error loading time slots:', error);
        showError(timeSlotsEl, `Failed to load time slots: ${error.message}. Please try again.`);
    }
}

// Display bookings
function displayBookings(bookings) {
    bookingsListEl.innerHTML = '';
    
    if (bookings.length === 0) {
        bookingsListEl.innerHTML = '<p>No bookings for this date yet</p>';
        return;
    }
    
    bookings.sort((a, b) => a.time.localeCompare(b.time));
    
    bookings.forEach(booking => {
        const bookingEl = document.createElement('div');
        bookingEl.className = 'booking-item';
        bookingEl.innerHTML = `
            <h4>${booking.name}</h4>
            <p>${formatTime(booking.time)} - 1 Hour</p>
            <p>Phone: ${booking.phone}</p>
        `;
        bookingsListEl.appendChild(bookingEl);
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
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    if (!name || !phone) {
        alert('Please enter your name and phone number');
        return;
    }
    
    if (!selectedDate || !selectedTime) {
        alert('Please select a date and time');
        return;
    }
    
    const bookingData = {
        name: name,
        phone: phone,
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
        
        // Check for existing booking
        const exists = await checkBookingExists(selectedDate, selectedTime);
        if (exists) {
            throw new Error('This time slot is already booked. Please choose another.');
        }
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(bookingData)
        });
        
        console.log('Response Status:', response.status);
        const text = await response.text();
        console.log('Raw Response:', text);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${text || 'Unknown error'}`);
        }
        
        let result = {};
        if (text) {
            try {
                result = JSON.parse(text);
                console.log('Parsed Response:', result);
            } catch (e) {
                console.warn('Non-JSON or empty response, proceeding as booking was saved:', text);
            }
        } else {
            console.log('Empty response body, proceeding as booking was saved');
        }
        
        successMessage.style.display = 'block';
        showReceipt(bookingData, result.id || 'N/A');
        await loadBookingsForDate(selectedDate);
        
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
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
    const response = await fetch(`${API_URL}?date=eq.${date}&time=eq.${time}&select=*`, {
        method: 'GET',
        headers: {
            'Apikey': API_KEY,
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });
    const bookings = await response.json();
    return bookings.length > 0;
}

// Show confirmation receipt
function showReceipt(bookingData, bookingId) {
    receiptMessage.innerHTML = `
        <h3>Booking Confirmation</h3>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Name:</strong> ${bookingData.name}</p>
        <p><strong>Phone:</strong> ${bookingData.phone}</p>
        <p><strong>Date:</strong> ${bookingData.date}</p>
        <p><strong>Time:</strong> ${formatTime(bookingData.time)}</p>
        <p><strong>Duration:</strong> 1 Hour</p>
        <p><strong>Status:</strong> Confirmed</p>
        <p>Thank you for booking with Suthar Badminton!</p>
    `;
    receiptMessage.style.display = 'block';
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