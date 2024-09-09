const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwtJson = require('jsonwebtoken');
const jwtSecret = 'jne12345';
const app = express();
const db = require('../db');
app.use(bodyParser.json());

app.use(cors({
  origin: ['https://jnejog.my.id', 'http://localhost:5173', 'https://report-bbm.jnejog.com'], // tdk boleh pakai garing ..com/
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.listen(2000, () => {
  console.log('Server listening , Ready to Go ');
});

app.get('/', (req, res) => {
  return res.status(404).send('</br> <h1 style="text-align: center;">404 </h1> </br> <h2 style="text-align: center;"> Not Found</h2>');
})

const accesValidation = (req, res, next) => {
  const { authorization } = req.headers
  if (!authorization) {
    return res.status(401).json({
      pesan: "UnAuthorized"
    })
  }
  const token = authorization.split(' ')[1]
  try {
    const jwtDecode = jwtJson.verify(token, jwtSecret)
    req.userData = jwtDecode
  } catch (error) {
    return res.status(401).json('UnAuthorized')
  }
  next()
}
// START USERS and Autentication______________________________________________
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    const results = await db.query(query, [username, password]);
    if (results.length > 0) {
      // User found, generate and send token
      const user = results[0];
      const token = jwtJson.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '2h' });
      return res.status(200).send({ token, user: { id: user.id, nama: user.nama, role: user.role } });
    } else {
      return res.status(401).send({ message: 'Username atau password salah' });
    }
  } catch (error) {
    console.error('Error saat login:', error);
    return res.status(500).send({ message: `Terjadi kesalahan saat login: ${error.message}` });
  }
});
// END USERS and Autentication ------------------------------------------------ 

app.post('/users', async (req, res) => {
  try {
    const { username, nama, password, role, status } = req.body;
    const query = `INSERT INTO users SET ?`;
    const data = { username, nama, password, role, status }
    const result = await db.query(query, data);
    if (result.insertId) return res.status(200).send({ message: 'User berhasil ditambahkan' });
  } catch (error) {
    console.error('Error saat menambahkan user:', error);
    return res.status(500).send({ message: 'Gagal menambahkan user' });
  }
});

app.get('/users', accesValidation, async (req, res) => {
  try {
    const query = `SELECT * FROM users`;
    const results = await db.query(query);
    return res.send(results);
  } catch (error) {
    console.error('Error saat mengambil data users:', error);
    return res.status(500).send({ message: 'Gagal mengambil data users' });
  }
});

app.put('/users', async (req, res) => {
  const { id, nama, username, password, role, status } = req.body;
  try {
    const query = `UPDATE users SET nama = ?, username = ?, password = ?, role = ?, status = ? WHERE id = ?`;
    const result = await db.query(query, [nama, username, password, role, status, id]);
    if (result) {
      return res.status(200).send({ message: 'User updated successfully' });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).send({ message: 'Error updating user' });
  }

});

app.delete('/users', async (req, res) => {
  const { id } = req.query;
  const query = `DELETE FROM users WHERE id = ?`;
  const result = await db.query(query, [id]);
  if (!result.affectedRows) {
    console.error('Error deleting user:', err);
    return res.status(500).send({ message: 'Error deleting user' });
  }
  return res.status(200).send({ message: 'User deleted successfully' });
});

// START  INPUT BBM
app.get('/tnkb', accesValidation, async (req, res) => {
  try {
    const query = 'SELECT tnkb FROM mobilops WHERE status = \'Y\'';
    const result = await db.query(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'error mendapatkan data tnkb' });
  }
});

app.get('/drivername', accesValidation, async (req, res) => {
  try {
    const query = 'SELECT nama FROM driver WHERE status = \'Y\'';
    const result = await db.query(query);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'error mendapatkan data bbm' });
  }
});

app.post('/inputbbm', async (req, res) => {
  const { tanggal, tnkb, jam_pengisian, liter, biaya, km_awal, driver } = req.body;
  try {
    let ms = Date.parse("1970-01-01T" + jam_pengisian);
    const data = {
      tanggal: new Date(tanggal),
      tnkb,
      jam_pengisian: new Date(ms),
      liter: parseInt(liter),
      biaya: parseInt(biaya),
      km_awal: parseInt(km_awal),
      km_akhir: 0,
      driver
    };
    const query = 'INSERT INTO beli_bbm SET ?';
    const result = await db.query(query, data);
    // update KM AKHIR
    if (result.insertId) {
      const findID = await db.query('SELECT id FROM beli_bbm WHERE tnkb = ? AND tanggal < ? ORDER BY tanggal DESC', [tnkb, new Date(tanggal)]);
      if (findID.length > 0) {
        const updateKm_akhir = await db.query('UPDATE beli_bbm SET km_akhir = ? WHERE id = ?', [parseInt(km_awal), findID[1].id]);
        return res.status(200).send({ message: 'sukses input Bbm' });
      } else {
        console.log('Tidak ada data sebelumnya untuk diupdate');
      }
    }
  } catch (error) {
    console.error('Error saat input BBM:', error);
    return res.status(500).send({ message: 'Server error saat input BBM' });
  }
});
// END INPUT BBM
// START REPORT BBM__________________________________________________________________________
app.get('/reportBbm', accesValidation, async (req, res) => {
  const tanggal1 = req.query.tgl1;
  const tanggal2 = req.query.tgl2;
  try {
    const query = 'SELECT * FROM beli_bbm WHERE tanggal BETWEEN ? AND ?';
    const result = await db.query(query, [tanggal1, tanggal2]);
    const data = result;
    const data1 = result;
    const waktu = data1.map((item) => {
      let idnya = item.id;
      let date = new Date(item.tanggal);
      let dateString = date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
      let jam = item.jam_pengisian;
      let jam2 = jam.substring(0, 5)
      // Perhitungan jarak dan konsumsi BBM
      let awal = item.km_awal;
      let akhir;
      let perLiter;
      let jarak;
      if (!item.km_akhir) {
        akhir = 0;
        perLiter = 0;
        jarak = 0;
      } else {
        akhir = item.km_akhir;
        jarak = (akhir) - (awal);
        perLiter = (jarak) / item.liter
      }
      if (!Number.isInteger(perLiter)) {
        perLiter = perLiter.toFixed(1);
      }
      return {
        id: idnya,
        tanggal: dateString,
        jam_pengisian: jam2,
        jarak_tempuh: jarak,
        komsumsiBbm: perLiter,
      };
    });
    const arrayGabungan = data.map((item1, index) => {
      let item2 = waktu.find((item) => item.id === item1.id);
      if (item2) {
        return { ...item1, ...item2 };
      } else {
        return item1;
      }
    });
    const queryMobil = 'SELECT tnkb, nama FROM mobilops';
    const namaMobil = await db.query(queryMobil);
    const arrayGabungan2 = arrayGabungan.map((item1, index) => {
      let item2 = namaMobil.find((item) => item.tnkb === item1.tnkb);
      if (item2) {
        return { ...item1, ...item2 };
      } else {
        return item1;
      }
    });
    const arrayDiurutkan = arrayGabungan2.map((obj) => {
      return {
        id: obj.id,
        Tanggal: obj.tanggal,
        Nama_Mobil: obj.nama,
        Tnkb: obj.tnkb,
        Jam_Pengisian: obj.jam_pengisian,
        Liter: obj.liter,
        Biaya: obj.biaya,
        Km_Awal: obj.km_awal,
        Km_Akhir: obj.km_akhir,
        Jarak_Tempuh: obj.jarak_tempuh,
        Konsumsi_PerLiter: obj.komsumsiBbm,
        Driver: obj.driver,
      };
    });
    if (!arrayDiurutkan) return res.status(500).send({ message: 'error mendapatkan data bbm' });
    return res.send(arrayDiurutkan);
  } catch (error) {
    console.error(error);
  }
});

app.delete('/reportBbm', async (req, res) => {
  const { id } = req.query;
  try {
    const query = 'DELETE FROM beli_bbm WHERE id = ?';
    const result = await db.query(query, id);
    if (!result.affectedRows) return res.status(500).send({ message: 'error delete' });
    else return res.status(200).send({ message: 'data delete sukses' });
  } catch (error) {
    console.error(error);
  }
});

app.put('/reportBbm', async (req, res) => {
  const { id, Tanggal, Tnkb, Jam_Pengisian, Liter, Biaya, Km_Awal, Driver } = req.body;
  try {
    let ms = Date.parse("1970-01-01T" + Jam_Pengisian);
    const tanggalObj = Date.parse(Tanggal);
    const tglobj = new Date(tanggalObj);
    const query = 'UPDATE beli_bbm SET ? WHERE id = ?';
    const data = {
      tanggal: tglobj,
      jam_pengisian: new Date(ms),
      tnkb: Tnkb,
      liter: parseInt(Liter.replace(/,/g, ''), 10),
      biaya: parseInt(Biaya.replace(/,/g, ''), 10),
      km_awal: parseInt(Km_Awal.replace(/,/g, ''), 10),
      driver: Driver,
    };
    const result = await db.query(query, [data, id]);
    if (!result) return res.status(500).send({ message: 'error update' });
    else {
      // ---- rubah KM Akhir-------------
      const tglDiupdate = new Date(Tanggal);
      const queryFindID = 'SELECT * FROM beli_bbm WHERE tnkb = ? AND tanggal < ? ORDER BY tanggal DESC';
      const findID = await db.query(queryFindID, [Tnkb, tglDiupdate]);
      const queryUpdateKm_akhir = 'UPDATE beli_bbm SET km_akhir = ? WHERE id = ?';
      const updateKm_akhir = await db.query(queryUpdateKm_akhir, [parseInt(Km_Awal.replace(/,/g, ''), 10), findID[0].id]);
      return res.status(200).send({ message: 'sukses update data' });
    }
  } catch (error) {
    console.error('Error saat update BBM:', error);
    res.status(500).send({ message: 'error saat update BBM' });
  }
});

app.get('/tnkbdriver', accesValidation, async (req, res) => {
  try {
    const queryTnkb = 'SELECT tnkb FROM mobilops';
    const tnkb = await db.query(queryTnkb);
    const queryDriver = 'SELECT nama FROM driver';
    const driver = await db.query(queryDriver);
    res.send({ tnkb, driver });
  } catch (error) {
    res.send(`error ambil data tnkb dan nama driver`, error);
  }
});
// END REPORT BBM________________________________________________________________________
// START tabel MOBILOPS_______________________________________________
app.get('/mobilops', accesValidation, async (req, res) => {
  try {
    const query = 'SELECT * FROM mobilops'; 2
    const result = await db.query(query);
    res.send(result);
  } catch (error) {
    console.error('error mendapatkan data mobil:', error);
    res.status(500).send({ message: 'error mendapatkan data mobil' });
  }
});

app.get('/mobilopsAktif', accesValidation, async (req, res) => {
  try {
    const query = 'SELECT * FROM mobilops WHERE status = ?';
    const result = await db.query(query, ['Y']);
    if (result) res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'error mendapatkan data mobil' })
  }
})

app.post('/mobilops', async (req, res) => {
  const { tnkb, nama, tahun, kepemilikan, status } = req.body
  try {
    const query = 'INSERT INTO mobilops (tnkb, nama, tahun, kepemilikan, status) VALUES (?, ?, ?, ?, ?)';
    const values = [tnkb, nama, parseInt(tahun), kepemilikan, status];
    const result = await db.query(query, values);
    if (result.insertId) return (res.status(200).send({ message: 'sukses menambah data mobilops' }))
  } catch (error) {
    console.error('Error saat create mobilops:', error);
    return res.status(500).send({ message: 'error saat create mobilops' });
  }
})

app.put('/mobilops', async (req, res) => {
  const { id, tnkb, nama, tahun, kepemilikan, status } = req.body
  try {
    const query = 'UPDATE mobilops SET tnkb = ?, nama = ?, tahun = ?, kepemilikan = ?, status = ? WHERE id = ?';
    const values = [tnkb, nama, parseInt(tahun), kepemilikan, status, id];
    const result = await db.query(query, values)
    if (result.affectedRows > 0) {
      return res.status(200).send({ message: 'Sukses mengupdate data' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Gaggal mengupdate data mobil' });
  }
})

app.delete('/mobilops', async (req, res) => {
  const { id } = req.query
  try {
    const query = 'DELETE FROM mobilops WHERE id = ?';
    const result = await db.query(query, [Number(id)])
    if (result.affectedRows > 0) {
      return res.status(200).send({ message: 'sukses hapus data' });
    }
  } catch (error) {
    return res.status(500).send({ message: 'Server error saat menghapus mobilops' });
  }
})
// END tabel MOBILOPS----
// START tabel DRIVER_______________________________________________________________
app.get('/driver', accesValidation, async (req, res) => {
  try {
    const query = 'SELECT * FROM driver';
    const results = await db.query(query);
    res.send(results);
  } catch (error) {
    console.error('Error mengambil data driver:', error);
    res.status(500).send({ message: 'Error mengambil data driver' });
  }
})

app.get('/driverAktif', accesValidation, async (req, res) => {
  try {
    const query = 'SELECT * FROM driver WHERE status = ?';
    const result = await db.query(query, ['Y']);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error mengambil data driver aktif' });
  }
})

app.post('/driver', async (req, res) => {
  const { nama, departemen, status } = req.body;
  try {
    const query = 'INSERT INTO driver SET ?';
    const data = { nama, departemen, status };
    const result = await db.query(query, data);
    if (!result.insertId) return res.status(500).send({ message: 'error create' });
    else return res.status(200).send({ message: 'sukses membuat data baru driver' });
  } catch (error) {
    console.error('Error saat create driver:', error);
    return res.status(500).send({ message: 'Server error saat create driver' });
  }
});

app.put('/driver', async (req, res) => {
  const { id, nama, departemen, status } = req.body;
  try {
    const query = 'UPDATE driver SET ? WHERE id = ?';
    const data = { nama, departemen, status };
    const result = await db.query(query, [data, id]);
    if (result.affectedRows) {
      return res.status(200).send({ message: 'driver updated successfully' });
    }
  } catch (error) {
    res.status(500).send({ message: 'error saat update driver' });
  }
});

app.delete('/driver', async (req, res) => {
  const { id } = req.query;
  try {
    const query = 'DELETE FROM driver WHERE id = ?';
    const result = await db.query(query, id);
    if (!result.affectedRows) return res.status(500).send({ message: 'error delete' });
    else return res.status(200).send({ message: 'driver delete sukses' });
  } catch (error) {
    console.error('Error saat delete driver:', error);
    return res.status(500).send({ message: 'Server error saat delete driver' });
  }
});
//END TABEL DRIVER-----------------------------------------------------------