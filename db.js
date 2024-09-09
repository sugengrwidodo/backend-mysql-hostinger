const mysql = require('mysql');

const db2 = mysql.createConnection({
    host: 'polite.jagoanhosting.com',
    user: 'jnejogmy_jnejog',
    password: '*H3NoJHJ$M2A',
    database: 'jnejogmy_armada',
    timeout: 10000, // 10 detik..
    reconnect: true
});

const db = mysql.createConnection({  
    host: 'srv1417.hstgr.io',
    user: 'u932143153_jnejog',
    password: 'Z9QR@hXGrR/a',
    database: 'u932143153_reportbbm',
    timeout: 10000, 
    reconnect: true
});

const db3 = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'armada',
    timeout: 10000, 
    reconnect: true
});

db.connect((err) => {
    if (err) {
        console.error('error connecting:', err);
        return;
    }
    console.log('connected as id ' + db.threadId);
});

const query = (sql, values) => {
    return new Promise((resolve, reject) => {
        db.query(sql, values, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

module.exports = { query };