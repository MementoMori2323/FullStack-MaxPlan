const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*', // Allow requests from any domain
  optionsSuccessStatus: 200
}));

const connection = mysql.createConnection({
  host: 'b6qbdwley7soevanfbv3-mysql.services.clever-cloud.com',
  user: 'um2laytkoqwm05o0',
  password: 'g96VtN3BCCEprgyIn4P8',
  database: 'b6qbdwley7soevanfbv3'
});

// host: 'gator4214.hostgator.com',
// user: 'artixpac_magnetto',
// password: 'Limecake23!',
// database: 'artixpac_insigniaresources'

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

const executeQuery = (query) => {
  return new Promise((resolve, reject) => {
    connection.query(query, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

app.get('/getAllData', async (req, res) => {
  try {
    const workstationsQuery = 'SELECT * FROM workstations ORDER BY assigned';
    const computersQuery = 'SELECT * FROM computers';
    const monitorsQuery = 'SELECT * FROM monitors';

    const allData = {};

    allData.workstations = await executeQuery(workstationsQuery);
    console.log('Workstations Data from MySQL:', allData.workstations);

    allData.computers = await executeQuery(computersQuery);
    console.log('Computers Data from MySQL:', allData.computers);

    allData.monitors = await executeQuery(monitorsQuery);
    console.log('Monitors Data from MySQL:', allData.monitors);

    res.json(allData);
  } catch (error) {
    console.error('Error executing MySQL query:', error);
    res.status(500).send('Internal Server Error');
  }
});

const port = 3306;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
