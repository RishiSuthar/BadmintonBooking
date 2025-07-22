// Supabase Configuration
const API_URL = 'https://wezgcqbagksqxyugqqad.supabase.co/rest/v1/bookings'; // Replace with your Supabase Project URL
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlemdjcWJhZ2tzcXh5dWdxcWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTUxNjksImV4cCI6MjA2ODY3MTE2OX0.AXnI7UgvWhnnAdZ5V9WGucdI4T-z2vTVAuRBU0R9qKQ'; // Replace with your Supabase Anon Public Key

// DOM Elements
const calendarEl = document.getElementById('calendar');
const timeSlotsEl = document.getElementById('time-slots');
const bookingsListEl = document.getElementById('bookings-list');
const bookBtn = document.getElementById('book-btn');
const successMessage = document.getElementById('success-message');
const tabs = document.querySelectorAll('.tab');
const currentYearEl = document.getElementById('current-year');

// Selected booking details
let selectedDate = null;
let selectedTime = null;
let selectedCourt = "Court 1";

// Initialize the application
async function init() {
    // Set current year in footer
    currentYearEl.textContent = new Date().getFullYear();
    
    // Generate calendar and load today's bookings
    generateCalendar();
    await loadBookingsForDate(getTodayDate());
    
    // Tab selection
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            selectedCourt = tab.dataset.court;
            updateBookingSummary();
            generateTimeSlotsForSelectedDate();
        });
    });
    
    // Book button event
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

// Generate calendar days
function generateCalendar() {
    calendarEl.innerHTML = '';
    
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Add 7 days starting from today
    for (let i = 0; i < 7; i++) {
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

// Generate time slots with actual bookings
function generateTimeSlots(bookings) {
    timeSlotsEl.innerHTML = '';
    
    // Get bookings for selected court
    const courtBookings = bookings.filter(b => b.court === selectedCourt);
    
    // Generate time slots from 8:00 AM to 10:00 PM
    for (let hour = 8; hour <= 22; hour++) {
        const time = `${hour}:00`;
        const isBooked = courtBookings.some(b => b.time === time);
        
        const slot = document.createElement('div');
        slot.className = 'slot';
        
        if (isBooked) {
            slot.classList.add('booked');
            slot.textContent = `${time} - Booked`;
        } else {
            slot.classList.add('available');
            slot.textContent = `${time} - Available`;
            slot.addEventListener('click', () => {
                document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
                selectedTime = time;
                updateBookingSummary();
            });
        }
        
        timeSlotsEl.appendChild(slot);
    }
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
    
    // Sort by time
    bookings.sort((a, b) => a.time.localeCompare(b.time));
    
    // Filter by selected court
    const courtBookings = bookings.filter(b => b.court === selectedCourt);
    
    if (courtBookings.length === 0) {
        bookingsListEl.innerHTML = `<p>No bookings for ${selectedCourt} on this date</p>`;
        return;
    }
    
    courtBookings.forEach(booking => {
        const bookingEl = document.createElement('div');
        bookingEl.className = 'booking-item';
        bookingEl.innerHTML = `
            <h4>${booking.name}</h4>
            <p>${booking.time} - ${booking.duration}</p>
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
        `Time: ${selectedTime || 'Not selected'}`;
    
    document.getElementById('summary-court').textContent = 
        `Court: ${selectedCourt || 'Not selected'}`;
}

async function handleBooking() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const duration = document.getElementById('duration').value;
    
    // Validate inputs
    if (!name || !phone) {
        alert('Please enter your name and phone number');
        return;
    }
    
    if (!selectedDate || !selectedTime) {
        alert('Please select a date and time');
        return;
    }
    
    // Prepare booking data (exclude id, as it's auto-incremented)
    const bookingData = {
        name: name,
        phone: phone,
        email: email,
        date: selectedDate,
        time: selectedTime,
        court: selectedCourt,
        duration: duration === '1' ? '1 Hour' : 
                 duration === '1.5' ? '1.5 Hours' : '2 Hours',
        status: 'Confirmed'
    };
    
    // Save original button text
    const originalBtnText = bookBtn.textContent;
    
    try {
        // Show loading state
        bookBtn.innerHTML = '<span class="loading"></span> Processing...';
        bookBtn.disabled = true;
        
        console.log('Sending booking data:', bookingData); // Log request payload
        
        // Send booking to Supabase
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(bookingData)
        });
        
        console.log('Response Status:', response.status); // Log status
        console.log('Response Headers:', [...response.headers]); // Log headers
        
        // Check if response body is empty
        const text = await response.text(); // Get raw response as text
        console.log('Raw Response:', text); // Log raw response
        
        // Try to parse as JSON
        let result;
        if (text) {
            result = JSON.parse(text); // This is where the error occurs
        } else {
            throw new Error('Empty response body');
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${result.message || 'Unknown error'}`);
        }
        
        // Show success message
        successMessage.style.display = 'block';
        
        // Refresh bookings
        await loadBookingsForDate(selectedDate);
        
        // Reset form
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('email').value = '';
        selectedTime = null;
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
        updateBookingSummary();
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        console.error('Booking error:', error);
        alert(`Failed to save booking: ${error.message}. Please try again.`);
    } finally {
        // Reset button state
        bookBtn.textContent = originalBtnText;
        bookBtn.disabled = false;
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