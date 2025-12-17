const cron = require('node-cron');
const { dbAll, dbRun, onDbReady } = require('./db');

class ChannelScheduler {
    constructor() {
        this.runningJobs = new Map(); // Map untuk menyimpan job yang sedang berjalan
        // Tunggu database ready sebelum inisialisasi scheduler
        onDbReady(() => {
            this.initializeScheduler();
        });
    }
    
    // Inisialisasi scheduler
    async initializeScheduler() {
        console.log('⏰ Initializing channel scheduler...');
        
        // Load semua channel dari database
        const channels = await this.getAllChannels();
        
        // Schedule untuk setiap channel
        channels.forEach(channel => {
            this.scheduleChannel(channel);
        });
        
        // Job untuk update countdown setiap detik
        cron.schedule('* * * * * *', () => {
            this.updateRunningCountdowns();
        });
        
        console.log(`✅ Scheduler initialized for ${channels.length} channels`);
    }
    
    // Ambil semua channel dari database
    async getAllChannels() {
        try {
            const channels = await dbAll(`
                SELECT id, no, title, status, countdown, countdown_type, 
                       duration, repeat_schedule as repeatSchedule
                FROM channels
            `);
            return channels;
        } catch (error) {
            console.error('Error fetching channels for scheduler:', error);
            return [];
        }
    }
    
    // Schedule sebuah channel
    scheduleChannel(channel) {
        const jobId = `channel_${channel.id}`;
        
        // Hentikan job lama jika ada
        if (this.runningJobs.has(jobId)) {
            const oldJob = this.runningJobs.get(jobId);
            oldJob.stop();
            this.runningJobs.delete(jobId);
        }
        
        // Jika channel status running, buat countdown job
        if (channel.status === 'running') {
            this.startCountdownJob(channel);
        }
        
        // Jika ada schedule repeat, buat job untuk repeat
        if (channel.repeatSchedule && channel.repeatSchedule !== 'Tidak') {
            this.scheduleRepeatJob(channel);
        }
    }
    
    // Job untuk countdown channel yang running
    startCountdownJob(channel) {
        const jobId = `countdown_${channel.id}`;
        
        // Update countdown setiap detik
        const job = cron.schedule('* * * * * *', async () => {
            try {
                await this.updateChannelCountdown(channel.id);
            } catch (error) {
                console.error(`Error updating countdown for channel ${channel.id}:`, error);
            }
        });
        
        this.runningJobs.set(jobId, job);
        console.log(`▶️ Countdown job started for channel ${channel.id}: ${channel.title}`);
    }
    
    // Job untuk repeat schedule
    scheduleRepeatJob(channel) {
        if (!channel.repeatSchedule || channel.repeatSchedule === 'Tidak') return;
        
        let cronExpression = '';
        
        // Parse repeat schedule
        switch(channel.repeatSchedule) {
            case 'Setiap Hari':
                cronExpression = '0 0 * * *'; // Setiap hari jam 00:00
                break;
            case 'Setiap Jam':
                cronExpression = '0 * * * *'; // Setiap jam
                break;
            case 'Setiap 30 Menit':
                cronExpression = '*/30 * * * *'; // Setiap 30 menit
                break;
            case 'Setiap Minggu':
                cronExpression = '0 0 * * 0'; // Setiap Minggu
                break;
            default:
                console.log(`Unknown repeat schedule: ${channel.repeatSchedule}`);
                return;
        }
        
        const jobId = `repeat_${channel.id}`;
        const job = cron.schedule(cronExpression, async () => {
            console.log(`🔁 Auto-restarting channel ${channel.id}: ${channel.title}`);
            await this.restartChannel(channel.id);
        });
        
        this.runningJobs.set(jobId, job);
        console.log(`🔁 Repeat job scheduled for channel ${channel.id}: ${channel.repeatSchedule}`);
    }
    
    // Update countdown untuk channel tertentu
    async updateChannelCountdown(channelId) {
        try {
            const channel = await dbAll(
                'SELECT countdown, countdown_type FROM channels WHERE id = ? AND status = "running"',
                [channelId]
            );
            
            if (channel.length === 0) return;
            
            let countdown = channel[0].countdown;
            const countdownType = channel[0].countdown_type;
            
            if (!countdown || countdown === '00:00:00') {
                // Countdown selesai, stop channel
                await this.stopChannelWhenCountdownEnds(channelId);
                return;
            }
            
            // Parse countdown (HH:MM:SS)
            const [hours, minutes, seconds] = countdown.split(':').map(Number);
            
            // Kurangi 1 detik
            let totalSeconds = hours * 3600 + minutes * 60 + seconds - 1;
            
            if (totalSeconds < 0) totalSeconds = 0;
            
            // Format kembali ke HH:MM:SS
            const newHours = Math.floor(totalSeconds / 3600);
            const newMinutes = Math.floor((totalSeconds % 3600) / 60);
            const newSeconds = totalSeconds % 60;
            
            const newCountdown = [
                newHours.toString().padStart(2, '0'),
                newMinutes.toString().padStart(2, '0'),
                newSeconds.toString().padStart(2, '0')
            ].join(':');
            
            // Update di database
            await dbRun(
                'UPDATE channels SET countdown = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newCountdown, channelId]
            );
            
        } catch (error) {
            console.error(`Error updating countdown for channel ${channelId}:`, error);
        }
    }
    
    // Update semua countdown yang running
    async updateRunningCountdowns() {
        try {
            const runningChannels = await dbAll(
                'SELECT id FROM channels WHERE status = "running" AND countdown IS NOT NULL'
            );
            
            runningChannels.forEach(channel => {
                this.updateChannelCountdown(channel.id);
            });
        } catch (error) {
            console.error('Error updating running countdowns:', error);
        }
    }
    
    // Stop channel ketika countdown selesai
    async stopChannelWhenCountdownEnds(channelId) {
        try {
            console.log(`⏹️ Countdown ended for channel ${channelId}, stopping...`);
            
            await dbRun(
                `UPDATE channels SET 
                    status = 'stopped', 
                    countdown = NULL,
                    countdown_type = NULL,
                    updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [channelId]
            );
            
            // Hentikan countdown job
            const jobId = `countdown_${channelId}`;
            if (this.runningJobs.has(jobId)) {
                this.runningJobs.get(jobId).stop();
                this.runningJobs.delete(jobId);
            }
            
            console.log(`✅ Channel ${channelId} stopped automatically`);
            
        } catch (error) {
            console.error(`Error stopping channel ${channelId}:`, error);
        }
    }
    
    // Restart channel (untuk repeat schedule)
    async restartChannel(channelId) {
        try {
            const channel = await dbAll(
                'SELECT duration FROM channels WHERE id = ?',
                [channelId]
            );
            
            if (channel.length === 0) return;
            
            // Parse duration (misal: "11h 55m")
            const duration = channel[0].duration;
            let hours = 11, minutes = 55; // default
            
            if (duration) {
                const match = duration.match(/(\d+)h\s*(\d+)m/);
                if (match) {
                    hours = parseInt(match[1]);
                    minutes = parseInt(match[2]);
                }
            }
            
            // Konversi ke countdown (HH:MM:SS)
            const totalSeconds = hours * 3600 + minutes * 60;
            const countdownHours = Math.floor(totalSeconds / 3600);
            const countdownMinutes = Math.floor((totalSeconds % 3600) / 60);
            const countdownSeconds = totalSeconds % 60;
            
            const countdown = [
                countdownHours.toString().padStart(2, '0'),
                countdownMinutes.toString().padStart(2, '0'),
                countdownSeconds.toString().padStart(2, '0')
            ].join(':');
            
            // Update channel ke status running
            await dbRun(
                `UPDATE channels SET 
                    status = 'running',
                    countdown = ?,
                    countdown_type = 'ends',
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [countdown, channelId]
            );
            
            // Start countdown job baru
            const channelData = await dbAll(
                'SELECT id, title FROM channels WHERE id = ?',
                [channelId]
            );
            
            if (channelData.length > 0) {
                this.startCountdownJob(channelData[0]);
            }
            
            console.log(`🔁 Channel ${channelId} restarted with countdown ${countdown}`);
            
        } catch (error) {
            console.error(`Error restarting channel ${channelId}:`, error);
        }
    }
    
    // Start channel secara manual
    async startChannel(channelId, duration) {
        try {
            let countdown = '11:55:00'; // default
            
            if (duration) {
                // Parse duration string
                const match = duration.match(/(\d+)h\s*(\d+)m/);
                if (match) {
                    const hours = parseInt(match[1]);
                    const minutes = parseInt(match[2]);
                    const totalSeconds = hours * 3600 + minutes * 60;
                    
                    const countdownHours = Math.floor(totalSeconds / 3600);
                    const countdownMinutes = Math.floor((totalSeconds % 3600) / 60);
                    const countdownSeconds = totalSeconds % 60;
                    
                    countdown = [
                        countdownHours.toString().padStart(2, '0'),
                        countdownMinutes.toString().padStart(2, '0'),
                        countdownSeconds.toString().padStart(2, '0')
                    ].join(':');
                }
            }
            
            await dbRun(
                `UPDATE channels SET 
                    status = 'running',
                    countdown = ?,
                    countdown_type = 'ends',
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [countdown, channelId]
            );
            
            // Dapatkan data channel untuk schedule job
            const channel = await dbAll(
                'SELECT id, title, repeat_schedule as repeatSchedule FROM channels WHERE id = ?',
                [channelId]
            );
            
            if (channel.length > 0) {
                this.scheduleChannel(channel[0]);
            }
            
            return { success: true, countdown };
            
        } catch (error) {
            console.error(`Error starting channel ${channelId}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    // Stop channel secara manual
    async stopChannel(channelId) {
        try {
            await dbRun(
                `UPDATE channels SET 
                    status = 'stopped',
                    countdown = NULL,
                    countdown_type = NULL,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [channelId]
            );
            
            // Hentikan semua job untuk channel ini
            const jobIds = [
                `countdown_${channelId}`,
                `repeat_${channelId}`
            ];
            
            jobIds.forEach(jobId => {
                if (this.runningJobs.has(jobId)) {
                    this.runningJobs.get(jobId).stop();
                    this.runningJobs.delete(jobId);
                }
            });
            
            return { success: true };
            
        } catch (error) {
            console.error(`Error stopping channel ${channelId}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    // Hentikan semua jobs (untuk shutdown)
    stopAllJobs() {
        this.runningJobs.forEach((job, jobId) => {
            job.stop();
            console.log(`⏹️ Stopped job: ${jobId}`);
        });
        this.runningJobs.clear();
    }
}

// Export singleton instance
const scheduler = new ChannelScheduler();
module.exports = scheduler;