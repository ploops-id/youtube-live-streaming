const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./db');
const scheduler = require('./scheduler');

const app = express();
const server = http.createServer(app);

// ✅ PERBAIKAN PATH: Gunakan path absolut
const frontendPath = path.join(__dirname, '../../frontend/public');
app.use(express.static(frontendPath));

// Middleware untuk parsing JSON
app.use(express.json());

// API Routes
app.get('/api/channels', async (req, res) => {
    try {
        const channels = await db.getAllChannels();
        res.json({ success: true, data: channels });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/channels', async (req, res) => {
    try {
        const { name, streamKey, title, file, duration, repeat } = req.body;
        const channel = await db.addChannel({
            name, streamKey, title, file, duration, repeat,
            status: 'stopped',
            countdown: '00:00:00'
        });
        res.json({ success: true, data: channel });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.patch('/api/channels/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db.updateChannelStatus(id, status);
        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'request_update') {
                const channels = await db.getAllChannels();
                ws.send(JSON.stringify({
                    type: 'channels_update',
                    data: channels
                }));
            } else if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });
});

// Default route - serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving static files from: ${frontendPath}`);
    
    // Initialize scheduler
    scheduler.initialize();
});

module.exports = { app, server };
