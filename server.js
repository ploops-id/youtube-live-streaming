const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { dbAll, dbRun, dbGet } = require('./db');
const scheduler = require('./scheduler');
const WebSocketServer = require('./websocket');

const app = express();
const PORT = 3000;

// Buat HTTP server untuk WebSocket
const server = http.createServer(app);

// Inisialisasi WebSocket server
const wsServer = new WebSocketServer(server);

// Dapatkan root directory dari project
const projectRoot = path.join(__dirname, '..');
const frontendPath = path.join(projectRoot, 'frontend');

// Cek apakah folder frontend ada
if (!fs.existsSync(frontendPath)) {
    console.error(`ERROR: Folder frontend tidak ditemukan di: ${frontendPath}`);
    console.log('Pastikan struktur folder:');
    console.log('C:\\Youtube-Streaming\\');
    console.log('  ├── backend\\');
    console.log('  │   ├── server.js');
    console.log('  │   ├── db.js');
    console.log('  │   ├── scheduler.js');
    console.log('  │   └── websocket.js');
    console.log('  └── frontend\\');
    process.exit(1);
}

console.log(`📁 Frontend path: ${frontendPath}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

// ==================== HELPER FUNCTIONS ====================

// Fungsi helper untuk broadcast update setelah operasi
function broadcastChannelsUpdate() {
    if (wsServer) {
        setTimeout(() => {
            wsServer.broadcastUpdate();
        }, 100);
    }
}

// ==================== API ROUTES ====================

// 1. GET semua channels
app.get('/api/channels', async (req, res) => {
    try {
        const channels = await dbAll(`
            SELECT 
                id, no, name, title, file, stream_key as streamKey,
                duration, repeat_schedule as repeatSchedule,
                status, countdown, countdown_type as countdownType,
                created_at as createdAt, updated_at as updatedAt
            FROM channels 
            ORDER BY no ASC
        `);
        
        // Format response sesuai frontend
        const formattedChannels = channels.map(channel => ({
            id: channel.id,
            no: channel.no,
            name: channel.name,
            title: channel.title,
            file: channel.file,
            streamKey: channel.streamKey,
            duration: channel.duration,
            repeat: channel.repeatSchedule,
            status: channel.status,
            countdown: channel.countdown,
            type: channel.countdownType
        }));
        
        res.json({
            success: true,
            data: formattedChannels,
            count: formattedChannels.length
        });
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil data channels' 
        });
    }
});

// 2. GET single channel by ID
app.get('/api/channels/:id', async (req, res) => {
    try {
        const channel = await dbGet(`
            SELECT 
                id, no, name, title, file, stream_key as streamKey,
                duration, repeat_schedule as repeatSchedule,
                status, countdown, countdown_type as countdownType
            FROM channels 
            WHERE id = ?
        `, [req.params.id]);
        
        if (!channel) {
            return res.status(404).json({ 
                success: false, 
                error: 'Channel tidak ditemukan' 
            });
        }
        
        res.json({ success: true, data: channel });
    } catch (error) {
        console.error('Error fetching channel:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil data channel' 
        });
    }
});

// 3. POST create new channel
app.post('/api/channels', async (req, res) => {
    try {
        const { 
            no, name, title, file, streamKey, 
            duration, repeatSchedule, status, countdown, countdownType 
        } = req.body;
        
        // Validasi
        if (!no || !name || !title || !file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Data tidak lengkap' 
            });
        }
        
        const result = await dbRun(`
            INSERT INTO channels 
            (no, name, title, file, stream_key, duration, 
             repeat_schedule, status, countdown, countdown_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [no, name, title, file, streamKey || `key-${Date.now()}`, 
            duration || '11h 55m', repeatSchedule || 'Setiap Hari',
            status || 'scheduled', countdown || '00:00:00', countdownType || 'start']);
        
        // Broadcast update setelah create
        broadcastChannelsUpdate();
        
        // Schedule channel baru
        const newChannel = await dbGet('SELECT * FROM channels WHERE id = ?', [result.id]);
        if (newChannel) {
            scheduler.scheduleChannel(newChannel);
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Channel berhasil dibuat',
            data: { id: result.id }
        });
        
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal membuat channel' 
        });
    }
});

// 4. PUT update channel
app.put('/api/channels/:id', async (req, res) => {
    try {
        const { 
            no, name, title, file, streamKey, 
            duration, repeatSchedule, status, countdown, countdownType 
        } = req.body;
        
        const result = await dbRun(`
            UPDATE channels SET
                no = ?, name = ?, title = ?, file = ?, stream_key = ?,
                duration = ?, repeat_schedule = ?, status = ?, 
                countdown = ?, countdown_type = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [no, name, title, file, streamKey, duration, 
            repeatSchedule, status, countdown, countdownType, req.params.id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Channel tidak ditemukan' 
            });
        }
        
        // Broadcast update setelah update
        broadcastChannelsUpdate();
        
        // Re-schedule channel
        const updatedChannel = await dbGet('SELECT * FROM channels WHERE id = ?', [req.params.id]);
        if (updatedChannel) {
            scheduler.scheduleChannel(updatedChannel);
        }
        
        res.json({ 
            success: true, 
            message: 'Channel berhasil diperbarui',
            changes: result.changes
        });
        
    } catch (error) {
        console.error('Error updating channel:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal memperbarui channel' 
        });
    }
});

// 5. DELETE channel
app.delete('/api/channels/:id', async (req, res) => {
    try {
        const result = await dbRun(
            'DELETE FROM channels WHERE id = ?', 
            [req.params.id]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Channel tidak ditemukan' 
            });
        }
        
        // Broadcast update setelah delete
        broadcastChannelsUpdate();
        
        // Stop scheduler jobs untuk channel ini
        scheduler.stopChannel(req.params.id);
        
        res.json({ 
            success: true, 
            message: 'Channel berhasil dihapus',
            changes: result.changes
        });
        
    } catch (error) {
        console.error('Error deleting channel:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal menghapus channel' 
        });
    }
});

// 6. PATCH update status channel
app.patch('/api/channels/:id/status', async (req, res) => {
    try {
        const { status, countdown, countdownType } = req.body;
        
        if (!status) {
            return res.status(400).json({ 
                success: false, 
                error: 'Status diperlukan' 
            });
        }
        
        let result;
        
        if (status === 'running') {
            // Dapatkan duration untuk menghitung countdown
            const channel = await dbGet(
                'SELECT duration FROM channels WHERE id = ?',
                [req.params.id]
            );
            
            const schedulerResult = await scheduler.startChannel(
                req.params.id, 
                channel?.duration
            );
            
            if (!schedulerResult.success) {
                return res.status(500).json({
                    success: false,
                    error: schedulerResult.error
                });
            }
            
            result = { changes: 1 };
            
        } else if (status === 'stopped') {
            const schedulerResult = await scheduler.stopChannel(req.params.id);
            
            if (!schedulerResult.success) {
                return res.status(500).json({
                    success: false,
                    error: schedulerResult.error
                });
            }
            
            result = { changes: 1 };
            
        } else {
            // Status lain (scheduled, etc)
            result = await dbRun(`
                UPDATE channels SET
                    status = ?, 
                    countdown = COALESCE(?, countdown),
                    countdown_type = COALESCE(?, countdown_type),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, countdown, countdownType, req.params.id]);
            
            if (result.changes > 0) {
                const channel = await dbGet('SELECT * FROM channels WHERE id = ?', [req.params.id]);
                if (channel) {
                    scheduler.scheduleChannel(channel);
                }
            }
        }
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Channel tidak ditemukan' 
            });
        }
        
        // Broadcast update
        broadcastChannelsUpdate();
        
        // Kirim notifikasi
        if (wsServer) {
            const channel = await dbGet(
                'SELECT title FROM channels WHERE id = ?',
                [req.params.id]
            );
            const channelName = channel ? channel.title : `Channel ${req.params.id}`;
            
            wsServer.broadcastNotification(
                'Status Updated',
                `${channelName} is now ${status}`,
                status === 'running' ? 'success' : 'warning'
            );
        }
        
        res.json({ 
            success: true, 
            message: `Status channel berhasil diubah ke ${status}`,
            changes: result.changes
        });
        
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengubah status channel' 
        });
    }
});

// 7. Bulk operations
app.post('/api/channels/bulk/update', async (req, res) => {
    try {
        const { channelIds, action, data } = req.body;
        
        if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Daftar channelIds diperlukan' 
            });
        }
        
        let sql = '';
        let params = [];
        
        if (action === 'start') {
            sql = `UPDATE channels SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id IN (${channelIds.map(() => '?').join(',')})`;
            params = channelIds;
        } else if (action === 'stop') {
            sql = `UPDATE channels SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id IN (${channelIds.map(() => '?').join(',')})`;
            params = channelIds;
        } else if (action === 'delete') {
            sql = `DELETE FROM channels WHERE id IN (${channelIds.map(() => '?').join(',')})`;
            params = channelIds;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Aksi tidak valid. Gunakan: start, stop, atau delete' 
            });
        }
        
        const result = await dbRun(sql, params);
        
        // Broadcast update setelah bulk operation
        broadcastChannelsUpdate();
        
        // Update scheduler untuk channel yang diubah
        if (action === 'start' || action === 'stop') {
            for (const channelId of channelIds) {
                const channel = await dbGet('SELECT * FROM channels WHERE id = ?', [channelId]);
                if (channel) {
                    scheduler.scheduleChannel(channel);
                }
            }
        }
        
        res.json({ 
            success: true, 
            message: `Berhasil melakukan ${action} pada ${result.changes} channel`,
            changes: result.changes
        });
        
    } catch (error) {
        console.error('Error bulk operation:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal melakukan operasi bulk' 
        });
    }
});

// 8. NEW: Get WebSocket connection info
app.get('/api/websocket/info', (req, res) => {
    res.json({
        success: true,
        data: {
            connectedClients: wsServer.getClientCount(),
            websocketUrl: `ws://localhost:${PORT}`,
            supportsWebSocket: true
        }
    });
});

// ==================== FRONTEND ROUTES ====================

// Route dasar
app.get('/', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html tidak ditemukan');
    }
});

// Route untuk dashboard
app.get('/dashboard', (req, res) => {
    const dashboardPath = path.join(frontendPath, 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
        res.sendFile(dashboardPath);
    } else {
        res.status(404).send('dashboard.html tidak ditemukan');
    }
});

// API test
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true,
        message: 'YOUTUBE LIVE STREAMING API is working!',
        version: '1.0.0',
        endpoints: [
            'GET    /api/channels',
            'GET    /api/channels/:id',
            'POST   /api/channels',
            'PUT    /api/channels/:id',
            'DELETE /api/channels/:id',
            'PATCH  /api/channels/:id/status',
            'POST   /api/channels/bulk/update',
            'GET    /api/websocket/info'
        ]
    });
});

// Start server dengan http server (untuk WebSocket)
server.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🔧 API Test: http://localhost:${PORT}/api/test`);
    console.log(`📁 API Channels: http://localhost:${PORT}/api/channels`);
    console.log(`💾 Database: database.sqlite`);
    console.log(`⏰ Scheduler: Active\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    scheduler.stopAllJobs();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});