# YouTube Live Streaming Automation

Sistem otomatisasi untuk streaming live YouTube dengan dashboard kontrol real-time, penjadwalan, dan manajemen video.

## Fitur Utama

- **Multi-channel Management** - Kelola banyak channel YouTube sekaligus
- **Real-time Dashboard** - Monitor status streaming secara live
- **Auto Scheduling** - Jadwalkan live streaming otomatis
- **Video Looping** - Putar video berulang untuk live stream
- **WebSocket Updates** - Update real-time tanpa refresh halaman
- **SQLite Database** - Penyimpanan data yang ringan dan cepat

## Teknologi Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript
- Bootstrap 5 untuk UI components
- Chart.js untuk statistik (rencana)

**Backend:**
- Node.js + Express.js
- WebSocket (ws library)
- SQLite3 database
- Node Schedule untuk penjadwalan

## Instalasi & Setup

### Prerequisites
- Node.js v16 atau lebih baru
- NPM atau Yarn
- Akun YouTube/Google dengan API access

### Langkah Instalasi

1. **Clone Repository**
```bash
git clone https://github.com/ploops-id/youtube-live-streaming.git
cd youtube-live-streaming