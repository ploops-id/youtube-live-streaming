// Fungsi untuk format tanggal Indonesia
function formatIndonesianDate(date) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 
                    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${dayName}, ${day}-${month}-${year}`;
}

// Fungsi untuk format waktu
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    // Tentukan timezone (WIB/WITA/WIT)
    const timezoneOffset = -date.getTimezoneOffset() / 60;
    let timezone = 'WIB';
    
    if (timezoneOffset === 8) {
        timezone = 'WITA';
    } else if (timezoneOffset === 9) {
        timezone = 'WIT';
    }
    
    return `${hours}:${minutes}:${seconds} ${timezone}`;
}

// Fungsi untuk update waktu setiap detik
function updateDateTime() {
    const now = new Date();
    const dateString = formatIndonesianDate(now);
    const timeString = formatTime(now);
    
    // Update elemen jika ada
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    
    if (dateElement) {
        dateElement.textContent = dateString;
    }
    
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    // Buat container untuk tanggal & waktu
    const timeContainer = document.createElement('div');
    timeContainer.id = 'time-container';
    timeContainer.style.cssText = `
        position: absolute;
        top: 20px;
        right: 25px;
        text-align: right;
        color: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        z-index: 1000;
    `;
    
    timeContainer.innerHTML = `
        <div id="current-date" style="font-size: 14px; font-weight: 500; margin-bottom: 2px;">
            Loading date...
        </div>
        <div id="current-time" style="font-size: 16px; font-weight: bold; font-family: 'Courier New', monospace;">
            Loading time...
        </div>
    `;
    
    // Tambahkan ke header
    const header = document.querySelector('.main-header');
    if (header) {
        header.style.position = 'relative'; // Agar absolute positioning work
        header.appendChild(timeContainer);
        
        // Update segera
        updateDateTime();
        
        // Update setiap detik
        setInterval(updateDateTime, 1000);
        
        console.log('✅ Time display initialized');
    } else {
        console.warn('⚠️ Header element not found for time display');
    }
});