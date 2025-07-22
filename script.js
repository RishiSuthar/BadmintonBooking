// Configuration - Replace with your Google Apps Script URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxnevUc9P5hCZG0MDtrlvuSEmAvvMLUAmgH7PL9RVLHrIcYSmkglQLVhKg2AJySAFDR/exec';

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
        
        const response = await fetch(`${API_URL}?date=${date}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            showError(bookingsListEl, data.error);
            return;
        }
        
        displayBookings(data.bookings);
        generateTimeSlots(data.bookings);
        selectDateOnCalendar(date);
    } catch (error) {
        console.error('Fetch error:', error);
        showError(bookingsListEl, 'Failed to load bookings. Please try again.');
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
    const courtBookings = bookings.filter(b => b.Court === selectedCourt);
    
    // Generate time slots from 8:00 AM to 10:00 PM
    for (let hour = 8; hour <= 22; hour++) {
        const time = `${hour}:00`;
        const isBooked = courtBookings.some(b => b.Time === time);
        
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
        const response = await fetch(`${API_URL}?date=${selectedDate}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.error) {
            generateTimeSlots(data.bookings);
        }
    } catch (error) {
        console.error('Error loading time slots:', error);
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
    bookings.sort((a, b) => a.Time.localeCompare(b.Time));
    
    // Filter by selected court
    const courtBookings = bookings.filter(b => b.Court === selectedCourt);
    
    if (courtBookings.length === 0) {
        bookingsListEl.innerHTML = `<p>No bookings for ${selectedCourt} on this date</p>`;
        return;
    }
    
    courtBookings.forEach(booking => {
        const bookingEl = document.createElement('div');
        bookingEl.className = 'booking-item';
        bookingEl.innerHTML = `
            <h4>${booking.Name}</h4>
            <p>${booking.Time} - ${booking.Duration}</p>
            <p>Phone: ${booking.Phone}</p>
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

// Handle booking submission
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
    
    // Prepare booking data
    const bookingData = {
        name: name,
        phone: phone,
        email: email,
        date: selectedDate,
        time: selectedTime,
        court: selectedCourt,
        duration: duration === '1' ? '1 Hour' : 
                 duration === '1.5' ? '1.5 Hours' : '2 Hours'
    };
    
    // Save original button text
    const originalBtnText = bookBtn.textContent;
    
    try {
        // Show loading state
        bookBtn.innerHTML = '<span class="loading"></span> Processing...';
        bookBtn.disabled = true;
        
        // Send booking to server
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
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
        alert(error.message || 'Failed to save booking. Please try again.');
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