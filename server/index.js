const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*', // Allow requests from any domain
  optionsSuccessStatus: 200
}));

const connection = mysql.createConnection({
  host: 'buwykpk0kg9it15ioa5j-mysql.services.clever-cloud.com',
  user: 'up2ry1fxt02v2bvk',
  password: 'pC6yOXwKINn1z0inU1tx',
  database: 'buwykpk0kg9it15ioa5j'
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
    const departmentsQuery = 'SELECT * FROM departments';
    const officesQuery = 'SELECT * FROM offices';
    const officesCoordinatesQuery = 'SELECT * FROM officescoordinates';

    const allData = {};

    allData.workstations = await executeQuery(workstationsQuery);
    console.log('Workstations Data from MySQL:', allData.workstations);

    allData.computers = await executeQuery(computersQuery);
    console.log('Computers Data from MySQL:', allData.computers);

    allData.monitors = await executeQuery(monitorsQuery);
    console.log('Monitors Data from MySQL:', allData.monitors);

    allData.departments = await executeQuery(departmentsQuery);
    console.log('Departments Data from MySQL:', allData.departments);

    allData.offices = await executeQuery(officesQuery);
    console.log('Offices Data from MySQL:', allData.offices);

    allData.officescoordinates = await executeQuery(officesCoordinatesQuery);
    console.log('OfficesCoordinates Data from MySQL:', allData.officescoordinates);

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
