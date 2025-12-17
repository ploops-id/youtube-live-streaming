const WebSocket = require('ws');
const { dbAll } = require('./db');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Set();
        this.initialize();
    }
    
    initialize() {
        this.wss.on('connection', (ws) => {
            console.log('🔗 New WebSocket client connected');
            this.clients.add(ws);
            
            // Kirim data awal
            this.sendChannelUpdates(ws);
            
            // Handle messages dari client
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });
            
            // Handle disconnect
            ws.on('close', () => {
                console.log('🔌 WebSocket client disconnected');
                this.clients.delete(ws);
            });
            
            // Handle error
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log('✅ WebSocket server initialized');
    }
    
    // Handle message dari client
    handleClientMessage(ws, data) {
        switch(data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
            case 'request_update':
                this.sendChannelUpdates(ws);
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }
    
    // Kirim update channel ke client
    async sendChannelUpdates(ws) {
        try {
            const channels = await dbAll(`
                SELECT 
                    id, no, name, title, file, stream_key as streamKey,
                    duration, repeat_schedule as repeatSchedule,
                    status, countdown, countdown_type as countdownType
                FROM channels 
                ORDER BY no ASC
            `);
            
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
            
            ws.send(JSON.stringify({
                type: 'channels_update',
                data: formattedChannels,
                timestamp: Date.now()
            }));
            
        } catch (error) {
            console.error('Error sending channel updates:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to fetch channels',
                timestamp: Date.now()
            }));
        }
    }
    
    // Broadcast update ke semua client
    async broadcastUpdate() {
        if (this.clients.size === 0) return;
        
        try {
            const channels = await dbAll(`
                SELECT 
                    id, no, name, title, file, stream_key as streamKey,
                    duration, repeat_schedule as repeatSchedule,
                    status, countdown, countdown_type as countdownType
                FROM channels 
                ORDER BY no ASC
            `);
            
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
            
            const message = JSON.stringify({
                type: 'channels_update',
                data: formattedChannels,
                timestamp: Date.now()
            });
            
            this.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
            
        } catch (error) {
            console.error('Error broadcasting update:', error);
        }
    }
    
    // Kirim notifikasi ke semua client
    broadcastNotification(title, message, type = 'info') {
        const notification = JSON.stringify({
            type: 'notification',
            data: { title, message, type, timestamp: Date.now() }
        });
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(notification);
            }
        });
    }
    
    // Get client count
    getClientCount() {
        return this.clients.size;
    }
}

module.exports = WebSocketServer;