// State untuk seleksi bulk
let selectedChannels = new Set();
let allChannels = [];
let websocket = null;
let isWebSocketConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// API base URL
const API_BASE = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000';

// ==================== TIME DISPLAY FUNCTIONS ====================

// Fungsi untuk format tanggal Indonesia
function formatIndonesianDate(date) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 
                    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${day} ${month} ${year}`;
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
    
    // Update elemen yang sudah ada di HTML
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    
    if (dateElement) {
        dateElement.textContent = dateString;
    }
    
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// Inisialisasi time display
function initTimeDisplay() {
    // Update segera
    updateDateTime();
    
    // Update setiap detik
    setInterval(updateDateTime, 1000);
    
    console.log('✅ Time display initialized');
}

// ==================== WEBSOCKET FUNCTIONS ====================

// Connect ke WebSocket
function connectWebSocket() {
    try {
        websocket = new WebSocket(WS_URL);
        
        websocket.onopen = () => {
            console.log('✅ WebSocket connected');
            isWebSocketConnected = true;
            reconnectAttempts = 0;
            
            // Request data awal
            websocket.send(JSON.stringify({ type: 'request_update' }));
            
            // Update UI
            document.querySelector('.server-status .status-dot').classList.add('running');
        };
        
        websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        websocket.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            isWebSocketConnected = false;
            
            // Update UI
            document.querySelector('.server-status .status-dot').classList.remove('running');
            document.querySelector('.server-status .status-dot').style.backgroundColor = '#e74c3c';
            
            // Coba reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(`Reconnecting... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                setTimeout(connectWebSocket, 3000);
            }
        };
        
        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            isWebSocketConnected = false;
        };
        
    } catch (error) {
        console.error('Error connecting WebSocket:', error);
        isWebSocketConnected = false;
    }
}

// Handle message dari WebSocket
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'channels_update':
            allChannels = data.data;
            renderChannelTable();
            updateLastUpdateTime();
            break;
            
        case 'notification':
            showNotification(data.data);
            break;
            
        case 'pong':
            // Ping-pong untuk keep-alive
            break;
            
        default:
            console.log('Unknown WebSocket message type:', data.type);
    }
}

// Kirim ping untuk keep-alive
function startWebSocketKeepAlive() {
    setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
    }, 30000); // Setiap 30 detik
}

// ==================== NOTIFICATION SYSTEM ====================

function showNotification(notification) {
    // Buat element notifikasi
    const notificationEl = document.createElement('div');
    notificationEl.className = `notification ${notification.type}`;
    notificationEl.innerHTML = `
        <div class="notification-header">
            <strong>${notification.title}</strong>
            <button class="notification-close">&times;</button>
        </div>
        <div class="notification-body">${notification.message}</div>
        <div class="notification-time">${new Date(notification.timestamp).toLocaleTimeString()}</div>
    `;
    
    // Tambah ke container notifikasi
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 300px;
        `;
        document.body.appendChild(container);
    }
    
    container.appendChild(notificationEl);
    
    // Auto-hide setelah 5 detik
    setTimeout(() => {
        notificationEl.style.opacity = '0';
        notificationEl.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.parentNode.removeChild(notificationEl);
            }
        }, 300);
    }, 5000);
    
    // Close button
    notificationEl.querySelector('.notification-close').addEventListener('click', () => {
        notificationEl.style.opacity = '0';
        notificationEl.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.parentNode.removeChild(notificationEl);
            }
        }, 300);
    });
}

// Update last update time
function updateLastUpdateTime() {
    const timeElement = document.getElementById('lastUpdateTime');
    if (timeElement) {
        timeElement.textContent = new Date().toLocaleTimeString();
    }
}

// ==================== CHANNEL FUNCTIONS ====================

// Fetch data dari API (fallback jika WebSocket tidak ada)
async function fetchChannels() {
    try {
        const response = await fetch(`${API_BASE}/channels`);
        const result = await response.json();
        
        if (result.success) {
            allChannels = result.data;
            renderChannelTable();
            updateLastUpdateTime();
            return result.data;
        } else {
            console.error('Error fetching channels:', result.error);
            showNotification({
                title: 'Error',
                message: 'Gagal memuat data channels',
                type: 'error',
                timestamp: Date.now()
            });
            return [];
        }
    } catch (error) {
        console.error('Network error:', error);
        showNotification({
            title: 'Connection Error',
            message: 'Cannot connect to server',
            type: 'error',
            timestamp: Date.now()
        });
        return [];
    }
}

// Render tabel channel
function renderChannelTable() {
    const tableBody = document.getElementById('channelTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    allChannels.forEach(channel => {
        const row = document.createElement('tr');
        
        // Tentukan kelas status dan teks
        let statusClass = '';
        let statusText = '';
        let countdownPrefix = '';
        let countdownClass = '';
        
        if (channel.status === 'running') {
            statusClass = 'status-running';
            statusText = `Running`;
            countdownPrefix = 'ENDS IN ';
            countdownClass = 'ends-in';
        } else if (channel.status === 'stopped') {
            statusClass = 'status-stopped';
            statusText = 'Stopped';
            countdownPrefix = '';
            countdownClass = '';
        } else {
            statusClass = 'status-scheduled';
            statusText = 'Scheduled';
            countdownPrefix = 'START IN ';
            countdownClass = 'start-in';
        }
        
        // Cek apakah channel ini terpilih
        const isChecked = selectedChannels.has(channel.id);
        
        row.innerHTML = `
            <td>
                <div class="checkbox-container">
                    <input type="checkbox" class="checkbox-select channel-checkbox" 
                           data-id="${channel.id}" ${isChecked ? 'checked' : ''}>
                </div>
            </td>
            <td>${channel.no}</td>
            <td><button class="btn-aksi" onclick="showAction(${channel.id})">Aksi</button></td>
            <td>${channel.name}</td>
            <td><strong>${channel.title}</strong></td>
            <td>${channel.file}</td>
            <td><code title="${channel.streamKey}">${channel.streamKey.substring(0, 10)}...</code></td>
            <td>${channel.duration}</td>
            <td>${channel.repeat}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td><span class="countdown ${countdownClass}">${countdownPrefix}${channel.countdown || '00:00:00'}</span></td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update total channels
    const totalElement = document.getElementById('totalChannels');
    if (totalElement) {
        totalElement.textContent = allChannels.length;
    }
    
    // Tambah event listener untuk checkbox
    setTimeout(() => {
        document.querySelectorAll('.channel-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleCheckboxChange);
        });
    }, 100);
}

// Handle perubahan checkbox
function handleCheckboxChange(e) {
    const channelId = parseInt(e.target.dataset.id);
    const isChecked = e.target.checked;
    
    if (isChecked) {
        selectedChannels.add(channelId);
    } else {
        selectedChannels.delete(channelId);
    }
    
    updateBulkSelection();
}

// Update tampilan bulk selection
function updateBulkSelection() {
    const bulkSelection = document.getElementById('bulkSelection');
    const selectedCount = document.getElementById('selectedCount');
    
    if (!bulkSelection || !selectedCount) return;
    
    selectedCount.textContent = selectedChannels.size;
    
    if (selectedChannels.size > 0) {
        bulkSelection.style.display = 'flex';
    } else {
        bulkSelection.style.display = 'none';
    }
}

// ==================== CHANNEL ACTIONS ====================

// Fungsi untuk tombol Aksi
async function showAction(channelId) {
    try {
        const response = await fetch(`${API_BASE}/channels/${channelId}`);
        const result = await response.json();
        
        if (result.success) {
            const channel = result.data;
            
            // Buat dialog custom
            const action = await showActionDialog(channel);
            if (action) {
                await handleChannelAction(channelId, action, channel);
            }
        }
    } catch (error) {
        console.error('Error fetching channel:', error);
        showNotification({
            title: 'Error',
            message: 'Gagal mengambil data channel',
            type: 'error',
            timestamp: Date.now()
        });
    }
}

// Dialog untuk pilih aksi
function showActionDialog(channel) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'action-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 300px;
        `;
        
        dialog.innerHTML = `
            <h4>${channel.title}</h4>
            <p>Status: <strong>${channel.status}</strong></p>
            <div class="action-buttons">
                <button class="action-btn start" data-action="start">▶ Start</button>
                <button class="action-btn stop" data-action="stop">⏹ Stop</button>
                <button class="action-btn edit" data-action="edit">✎ Edit</button>
                <button class="action-btn delete" data-action="delete">🗑 Delete</button>
                <button class="action-btn cancel" data-action="cancel">Cancel</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Tambah overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;
        document.body.appendChild(overlay);
        
        // Handle button clicks
        dialog.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                
                // Remove elements
                document.body.removeChild(dialog);
                document.body.removeChild(overlay);
                
                if (action !== 'cancel') {
                    resolve(action);
                } else {
                    resolve(null);
                }
            });
        });
        
        // Style buttons
        setTimeout(() => {
            dialog.querySelectorAll('.action-btn').forEach(btn => {
                btn.style.cssText = `
                    padding: 8px 16px;
                    margin: 5px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                `;
                
                if (btn.classList.contains('start')) {
                    btn.style.background = '#27ae60';
                    btn.style.color = 'white';
                } else if (btn.classList.contains('stop')) {
                    btn.style.background = '#e74c3c';
                    btn.style.color = 'white';
                } else if (btn.classList.contains('edit')) {
                    btn.style.background = '#3498db';
                    btn.style.color = 'white';
                } else if (btn.classList.contains('delete')) {
                    btn.style.background = '#7f8c8d';
                    btn.style.color = 'white';
                } else {
                    btn.style.background = '#95a5a6';
                    btn.style.color = 'white';
                }
            });
        }, 10);
    });
}

// Handle aksi channel
async function handleChannelAction(channelId, action, channel) {
    switch(action) {
        case 'start':
            await updateChannelStatus(channelId, 'running');
            break;
        case 'stop':
            await updateChannelStatus(channelId, 'stopped');
            break;
        case 'edit':
            editChannel(channel);
            break;
        case 'delete':
            if (confirm(`Hapus channel "${channel.title}"?`)) {
                await deleteChannel(channelId);
            }
            break;
    }
}

// Update status channel
async function updateChannelStatus(channelId, status) {
    try {
        showNotification({
            title: 'Processing',
            message: `Changing status to ${status}...`,
            type: 'info',
            timestamp: Date.now()
        });
        
        const response = await fetch(`${API_BASE}/channels/${channelId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification({
                title: 'Success',
                message: `Channel status changed to ${status}`,
                type: 'success',
                timestamp: Date.now()
            });
            
            // Refresh data via WebSocket atau API
            if (!isWebSocketConnected) {
                await fetchChannels();
            }
        } else {
            showNotification({
                title: 'Error',
                message: result.error,
                type: 'error',
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification({
            title: 'Error',
            message: 'Gagal mengubah status channel',
            type: 'error',
            timestamp: Date.now()
        });
    }
}

// Delete channel
async function deleteChannel(channelId) {
    try {
        const response = await fetch(`${API_BASE}/channels/${channelId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification({
                title: 'Success',
                message: 'Channel deleted successfully',
                type: 'success',
                timestamp: Date.now()
            });
            
            // Refresh data
            if (!isWebSocketConnected) {
                await fetchChannels();
            }
        } else {
            showNotification({
                title: 'Error',
                message: result.error,
                type: 'error',
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('Error deleting channel:', error);
        showNotification({
            title: 'Error',
            message: 'Gagal menghapus channel',
            type: 'error',
            timestamp: Date.now()
        });
    }
}

// Edit channel (skeleton)
function editChannel(channel) {
    showNotification({
        title: 'Coming Soon',
        message: 'Edit feature will be implemented in the next phase',
        type: 'info',
        timestamp: Date.now()
    });
}

// ==================== BULK ACTIONS ====================

async function bulkStartSelected() {
    if (selectedChannels.size === 0) {
        showNotification({
            title: 'Warning',
            message: 'Pilih channel terlebih dahulu!',
            type: 'warning',
            timestamp: Date.now()
        });
        return;
    }
    
    if (confirm(`Start ${selectedChannels.size} channel terpilih?`)) {
        await bulkUpdateChannels('start');
    }
}

async function bulkStopSelected() {
    if (selectedChannels.size === 0) {
        showNotification({
            title: 'Warning',
            message: 'Pilih channel terlebih dahulu!',
            type: 'warning',
            timestamp: Date.now()
        });
        return;
    }
    
    if (confirm(`Stop ${selectedChannels.size} channel terpilih?`)) {
        await bulkUpdateChannels('stop');
    }
}

async function bulkUpdateChannels(action) {
    try {
        const channelIds = Array.from(selectedChannels);
        
        showNotification({
            title: 'Processing',
            message: `${action === 'start' ? 'Starting' : 'Stopping'} ${channelIds.length} channels...`,
            type: 'info',
            timestamp: Date.now()
        });
        
        const response = await fetch(`${API_BASE}/channels/bulk/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                channelIds, 
                action 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification({
                title: 'Success',
                message: result.message,
                type: 'success',
                timestamp: Date.now()
            });
            
            bulkDeselectAll();
            
            // Refresh data
            if (!isWebSocketConnected) {
                await fetchChannels();
            }
        } else {
            showNotification({
                title: 'Error',
                message: result.error,
                type: 'error',
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('Error bulk update:', error);
        showNotification({
            title: 'Error',
            message: 'Gagal melakukan operasi bulk',
            type: 'error',
            timestamp: Date.now()
        });
    }
}

function bulkDeselectAll() {
    selectedChannels.clear();
    document.querySelectorAll('.channel-checkbox').forEach(cb => cb.checked = false);
    updateBulkSelection();
}

// Fungsi untuk seleksi semua
function selectAllChannels() {
    const checkboxes = document.querySelectorAll('.channel-checkbox');
    const isChecked = selectedChannels.size !== allChannels.length;
    
    checkboxes.forEach(checkbox => {
        const channelId = parseInt(checkbox.dataset.id);
        
        if (isChecked) {
            checkbox.checked = true;
            selectedChannels.add(channelId);
        } else {
            checkbox.checked = false;
            selectedChannels.delete(channelId);
        }
    });
    
    updateBulkSelection();
}

// ==================== INITIALIZATION ====================

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing dashboard...');
    
    // Inisialisasi time display
    initTimeDisplay();
    
    // Update footer dengan connection info
    updateFooterWithConnectionInfo();
    
    // Coba connect WebSocket
    connectWebSocket();
    
    // Start keep-alive
    startWebSocketKeepAlive();
    
    // Load data awal (fallback jika WebSocket lambat)
    setTimeout(async () => {
        if (allChannels.length === 0) {
            console.log('Fetching initial data via API...');
            await fetchChannels();
        }
    }, 1000);
    
    // Setup event listeners
    setupEventListeners();
});

// Update footer dengan info koneksi
function updateFooterWithConnectionInfo() {
    const footer = document.querySelector('.footer');
    if (footer) {
        const connectionInfo = document.createElement('div');
        connectionInfo.id = 'connectionInfo';
        connectionInfo.style.fontSize = '12px';
        connectionInfo.style.opacity = '0.8';
        connectionInfo.innerHTML = `
            <span id="wsStatus">WS: Connecting...</span> | 
            <span id="lastUpdate">Last update: <span id="lastUpdateTime">${new Date().toLocaleTimeString()}</span></span>
        `;
        footer.appendChild(connectionInfo);
    }
}

// Setup semua event listeners
function setupEventListeners() {
    // Tombol kontrol utama
    document.getElementById('btnStartAll')?.addEventListener('click', async function() {
        if (confirm('Start semua channel yang scheduled?')) {
            const scheduledChannels = allChannels.filter(c => c.status === 'scheduled');
            if (scheduledChannels.length > 0) {
                const channelIds = scheduledChannels.map(c => c.id);
                await bulkUpdateChannels('start');
            } else {
                showNotification({
                    title: 'Info',
                    message: 'Tidak ada channel yang scheduled',
                    type: 'info',
                    timestamp: Date.now()
                });
            }
        }
    });
    
    document.getElementById('btnStopAll')?.addEventListener('click', async function() {
        if (confirm('Stop semua channel yang running?')) {
            const runningChannels = allChannels.filter(c => c.status === 'running');
            if (runningChannels.length > 0) {
                const channelIds = runningChannels.map(c => c.id);
                await bulkUpdateChannels('stop');
            } else {
                showNotification({
                    title: 'Info',
                    message: 'Tidak ada channel yang running',
                    type: 'info',
                    timestamp: Date.now()
                });
            }
        }
    });
    
    document.getElementById('btnRepeatAll')?.addEventListener('click', function() {
        showNotification({
            title: 'Info',
            message: 'Repeat all feature uses the scheduled repeat settings',
            type: 'info',
            timestamp: Date.now()
        });
    });
    
    // Bulk action listeners
    document.getElementById('bulkStart')?.addEventListener('click', bulkStartSelected);
    document.getElementById('bulkStop')?.addEventListener('click', bulkStopSelected);
    document.getElementById('bulkDeselect')?.addEventListener('click', bulkDeselectAll);
    
    // Select all checkbox di header
    const thead = document.querySelector('.channel-table thead');
    if (thead) {
        const selectAllTh = thead.querySelector('th:first-child');
        if (selectAllTh && !selectAllTh.querySelector('#selectAllCheckbox')) {
            selectAllTh.innerHTML = `
                <div class="checkbox-container">
                    <input type="checkbox" id="selectAllCheckbox">
                </div>
            `;
            
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', selectAllChannels);
            }
        }
    }
    
    // Auto-update WebSocket status display
    setInterval(() => {
        const wsStatus = document.getElementById('wsStatus');
        if (wsStatus) {
            if (isWebSocketConnected) {
                wsStatus.innerHTML = 'WS: <span style="color:#27ae60">Connected</span>';
                wsStatus.title = 'WebSocket connected - real-time updates active';
            } else {
                wsStatus.innerHTML = 'WS: <span style="color:#e74c3c">Disconnected</span>';
                wsStatus.title = 'WebSocket disconnected - using API polling';
            }
        }
    }, 2000);
}