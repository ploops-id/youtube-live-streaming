const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path untuk database
const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Buat koneksi database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
        createTables();
    }
});

// Fungsi untuk membuat tabel
function createTables() {
    // Tabel channels
    db.run(`CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        no INTEGER NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        file TEXT NOT NULL,
        stream_key TEXT NOT NULL,
        duration TEXT NOT NULL,
        repeat_schedule TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        countdown TEXT,
        countdown_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating channels table:', err.message);
        } else {
            console.log('✅ Channels table ready');
            // Insert data dummy jika tabel kosong
            insertDummyData();
        }
    });
}

// Fungsi untuk insert data dummy
function insertDummyData() {
    db.get("SELECT COUNT(*) as count FROM channels", (err, row) => {
        if (err) {
            console.error('Error checking channels:', err.message);
            return;
        }
        
        if (row.count === 0) {
            console.log('Inserting dummy data...');
            
            const dummyChannels = [
                // Channel 1-7: Running
                [1, 'd2kg', 'D2KG LIVE 1', 'Looping Video Live 1.mps4', 'd2kg-live-key-001', '11h 55m', 'Setiap Hari', 'running', '08:25:59', 'ends'],
                [2, 'd2kg', 'D2KG LIVE 2', 'Looping Video Live 2.mps4', 'd2kg-live-key-002', '11h 55m', 'Setiap Hari', 'running', '08:55:58', 'ends'],
                [3, 'd2kg', 'D2KG LIVE 3', 'Looping Video Live 3.mps4', 'd2kg-live-key-003', '11h 55m', 'Setiap Hari', 'running', '09:25:59', 'ends'],
                [4, 'd2kg', 'D2KG LIVE 4', 'Looping Video Live 4.mps4', 'd2kg-live-key-004', '11h 55m', 'Setiap Hari', 'running', '09:55:59', 'ends'],
                [5, 'd2kg', 'D2KG LIVE 5', 'Looping Video Live 5.mps4', 'd2kg-live-key-005', '11h 55m', 'Setiap Hari', 'running', '10:25:59', 'ends'],
                [6, 'd2kg', 'D2KG LIVE 6', 'Looping Video Live 6.mps4', 'd2kg-live-key-006', '11h 55m', 'Setiap Hari', 'running', '10:55:59', 'ends'],
                [7, 'd2kg', 'D2KG LIVE 7', 'Looping Video Live 7.mps4', 'd2kg-live-key-007', '11h 55m', 'Setiap Hari', 'running', '11:25:59', 'ends'],
                // Channel 8-17: Scheduled
                [8, 'd2kg', 'D2KG LIVE 8', 'Looping Video Live 8.mps4', 'd2kg-live-key-008', '11h 55m', 'Setiap Hari', 'scheduled', '00:00:57', 'start'],
                [9, 'd2kg', 'D2KG LIVE 9', 'Looping Video Live 9.mps4', 'd2kg-live-key-009', '11h 55m', 'Setiap Hari', 'scheduled', '00:30:57', 'start'],
                [10, 'd2kg', 'D2KG LIVE 10', 'Looping Video Live 10.mps4', 'd2kg-live-key-010', '11h 55m', 'Setiap Hari', 'scheduled', '01:00:57', 'start'],
                [11, 'd2kg', 'D2KG LIVE 11', 'Looping Video Live 11.mps4', 'd2kg-live-key-011', '11h 55m', 'Setiap Hari', 'scheduled', '01:30:57', 'start'],
                [12, 'd2kg', 'D2KG LIVE 12', 'Looping Video Live 12.mps4', 'd2kg-live-key-012', '11h 55m', 'Setiap Hari', 'scheduled', '02:00:57', 'start'],
                [13, 'd2kg', 'D2KG LIVE 13', 'Looping Video Live 13.mps4', 'd2kg-live-key-013', '11h 55m', 'Setiap Hari', 'scheduled', '02:30:57', 'start'],
                [14, 'd2kg', 'D2KG LIVE 14', 'Looping Video Live 14.mps4', 'd2kg-live-key-014', '11h 55m', 'Setiap Hari', 'scheduled', '03:00:57', 'start'],
                [15, 'd2kg', 'D2KG LIVE 15', 'Looping Video Live 15.mps4', 'd2kg-live-key-015', '11h 55m', 'Setiap Hari', 'scheduled', '03:30:57', 'start'],
                [16, 'd2kg', 'D2KG LIVE 16', 'Looping Video Live 16.mps4', 'd2kg-live-key-016', '11h 55m', 'Setiap Hari', 'scheduled', '04:00:57', 'start'],
                [17, 'd2kg', 'D2KG LIVE 17', 'Looping Video Live 17.mps4', 'd2kg-live-key-017', '11h 55m', 'Setiap Hari', 'scheduled', '04:30:57', 'start']
            ];
            
            const stmt = db.prepare(`
                INSERT INTO channels 
                (no, name, title, file, stream_key, duration, repeat_schedule, status, countdown, countdown_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            dummyChannels.forEach(channel => {
                stmt.run(channel, (err) => {
                    if (err) console.error('Error inserting dummy data:', err.message);
                });
            });
            
            stmt.finalize();
            console.log('✅ Dummy data inserted');
        }
    });
}

// Fungsi helper untuk query database dengan promise
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Variabel untuk callback ketika database ready
let dbReadyCallbacks = [];
let isDbReady = false;

// Fungsi untuk register callback ketika db ready
function onDbReady(callback) {
    if (isDbReady) {
        callback();
    } else {
        dbReadyCallbacks.push(callback);
    }
}

// Panggil semua callback ketika tabel siap
function notifyDbReady() {
    isDbReady = true;
    console.log('✅ Database is ready for queries');
    dbReadyCallbacks.forEach(callback => callback());
    dbReadyCallbacks = [];
}

// Panggil notifyDbReady setelah tabel dibuat
// Di dalam fungsi createTables(), setelah berhasil membuat tabel:
function createTables() {
    // Tabel channels
    db.run(`CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        no INTEGER NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        file TEXT NOT NULL,
        stream_key TEXT NOT NULL,
        duration TEXT NOT NULL,
        repeat_schedule TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        countdown TEXT,
        countdown_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating channels table:', err.message);
        } else {
            console.log('✅ Channels table ready');
            // Panggil notify setelah tabel dibuat
            notifyDbReady();
            // Insert data dummy jika tabel kosong
            insertDummyData();
        }
    });
}

module.exports = {
    db,
    dbAll,
    dbRun,
    dbGet,
    onDbReady
};