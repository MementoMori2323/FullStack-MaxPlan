const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const app = express();

// Middleware to parse JSON bodies and cookies
app.use(express.json());
app.use(cookieParser());

// Configure CORS
app.use(cors({
  origin: 'https://property-management-demo.vercel.app', // Update this with your frontend's domain
  credentials: true // Enable credentials sharing
}));

// Secure session configuration
app.use(session({
  genid: () => uuidv4(), // Generate unique session ID
  secret: '12AB-34CD-WppQ38S', // Replace with a strong secret key
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Prevent access to cookies via JavaScript
    secure: false,   // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 1 day session expiry
  }
}));

// Database connection and query execution
const connection = mysql.createPool({
  host: 'bhvdu4rxfktmvhdswm1c-mysql.services.clever-cloud.com',
  user: 'u6wol2otqb50uy0i',
  password: 'ROZc7jsxTU8x7j3qHTM6',
  database: 'bhvdu4rxfktmvhdswm1c'
});

const executeQuery = (query, values) => {
  return new Promise((resolve, reject) => {
    connection.query(query, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Set Cache-Control headers to prevent caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.post('/loginSubmit', async (req, res) => {
  try {
    const { email, password } = req.body;

    const userQuery = 'SELECT * FROM users WHERE email = ?';
    const [user] = await executeQuery(userQuery, [email]);

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    req.session.userId = user.userid;
    req.session.username = user.username;
    req.session.jobtitle = user.jobtitle;
    req.session.email = user.email;
    req.session.role = user.role;

    res.status(200).json({ message: 'Login successful', user: { userid: user.userid, username: user.username, jobtitle: user.jobtitle, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Logout Endpoint
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    // Clear the cookie
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: false // Set to true if using HTTPS
    });

    res.status(200).json({ message: 'Logout successful' });
  });
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

const convertBlobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    if (!blob) {
      resolve(null);
      return;
    }

    const base64String = blob.toString('base64');

    // Determine MIME type based on the image data's signature
    let mimeType = 'image/jpeg'; // Default to JPEG

    if (blob.length > 0) {
      // Check the magic number for PNG files
      if (blob[0] === 0x89 && blob[1] === 0x50 && blob[2] === 0x4e && blob[3] === 0x47) {
        mimeType = 'image/png';
      }
    }

    resolve(`data:${mimeType};base64,${base64String}`);
  });
};


// Example authenticated route
app.get('/getAllData', isAuthenticated, async (req, res) => {
  try {
    const reportsQuery = 'SELECT * FROM reports';
    const statusesQuery = 'SELECT * FROM statuses';
    const usersQuery = 'SELECT * FROM users';
    const allData = {};

    // Fetch data from MySQL
    allData.reports = await executeQuery(reportsQuery);
    allData.statuses = await executeQuery(statusesQuery);
    allData.users = await executeQuery(usersQuery);

    // Convert BLOB data to Base64 with error handling
    const reportsWithBase64Images = await Promise.all(allData.reports.map(async (report) => {
      try {
        const base64Image = await convertBlobToBase64(report.imagedata);
        return {
          ...report,
          imagedata: base64Image,
        };
      } catch (conversionError) {
        console.error('Error converting image data:', conversionError);
        return {
          ...report,
          imagedata: 'Error converting image',
        };
      }
    }));

    // Send the modified data
    res.json({
      reports: reportsWithBase64Images,
      statuses: allData.statuses,
      users: allData.users,
    });
  } catch (error) {
    console.error('Error executing MySQL query:', error);
    res.status(500).send('Internal Server Error');
  }
});


const storage = multer.memoryStorage(); // Store files in memory as buffer
const upload = multer({ storage: storage });
// Reports form submit
app.post('/submitReport', upload.single('imagedata'), async (req, res) => {
  try {
    // Destructure fields from request body
    const { createdby, createdat, title, status, comments, levelindex, x, z, elevation } = req.body;
    const imageFile = req.file; // Access the uploaded file

    // Ensure all required fields are provided
    if (!createdat || !title || !status || !createdby) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Extract username from createdby object if it is an object
    const createdByValue = typeof createdby === 'object' && createdby.username
      ? createdby.username
      : createdby;

    // SQL query for inserting the report into the database, including imagedata
    const insertQuery = `
      INSERT INTO reports (
        createdby, createdat, title, status, comments, levelindex, x, z, elevation, imagedata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Execute the query with provided values
    const result = await executeQuery(insertQuery, [
      createdByValue,
      createdat,
      title,
      status,
      comments,
      levelindex,
      x,
      z,
      elevation,
      imageFile ? imageFile.buffer : null // Store the file data as a BLOB
    ]);

    res.status(200).json({ reportId: result.insertId });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Example endpoint for image retrieval
app.get('/image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT imagedata FROM reports WHERE id = ?';
    const result = await executeQuery(query, [id]);

    if (result.length > 0) {
      const imageBlob = result[0].imagedata;
      res.setHeader('Content-Type', 'image/jpeg'); // Set the appropriate MIME type
      res.send(imageBlob);
    } else {
      res.status(404).send('Image not found');
    }
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Add a new endpoint to check if reportid exists
app.get('/checkReportId/:reportid', async (req, res) => {
  const { reportid } = req.params;

  try {
    const checkQuery = 'SELECT COUNT(*) AS count FROM reports WHERE reportid = ?';
    const result = await executeQuery(checkQuery, [reportid]);

    const exists = result[0].count > 0;
    res.json({ exists });
  } catch (error) {
    console.error('Error checking reportid:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Account registration
app.post('/submitRegistrationFormData', async (req, res) => {
  try {
    const { username, email, jobtitle, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = 'INSERT INTO users (username, email, jobtitle, password, role) VALUES (?, ?, ?, ?, ?)';
    await executeQuery(insertQuery, [username, email, jobtitle, hashedPassword, role]);

    res.status(200).send('Form data submitted successfully');
  } catch (error) {
    console.error('Error submitting form data:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to check if user is authenticated
app.get('/checkAuth', (req, res) => {
  console.log('Session:', req.session); // Log session details
  if (req.session.userId) {
    res.status(200).json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Query to Edit Users roles/jobtitles
app.post('/editUser', async (req, res) => {
  try {
    const { username, jobtitle, role } = req.body;

    if (!username) {
      return res.status(400).send('Username is required');
    }

    console.log('Request body:', req.body); // Log the request body for debugging

    // Initialize SQL query and parameters
    let updateQuery = 'UPDATE users SET ';
    const queryParams = [];

    // Build the query based on which fields are provided
    if (jobtitle) {
      updateQuery += 'jobtitle = ?, ';
      queryParams.push(jobtitle);
    }

    if (role) {
      updateQuery += 'role = ?, ';
      queryParams.push(role);
    }

    // Remove trailing comma and space, and add the WHERE clause
    updateQuery = updateQuery.slice(0, -2) + ' WHERE username = ?';
    queryParams.push(username);

    console.log('Executing query:', updateQuery, queryParams); // Log query and params

    // Check if queryParams has values before executing the query
    if (queryParams.length === 0) {
      return res.status(400).send('No fields to update');
    }

    const result = await executeQuery(updateQuery, queryParams);

    console.log('Update result:', result); // Log the result of the query

    res.status(200).send('User updated successfully');
  } catch (error) {
    console.error('Error updating user:', error.message);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
});

// Query to delete user from DataBase
app.post('/deleteUser', async (req, res) => {
  try {
    const { username } = req.body; 

    const deleteUserQuery = `
      DELETE FROM users 
      WHERE username = ?
    `;
    
    await executeQuery(deleteUserQuery, [username]); 

    res.status(200).send('User deleted successfully');
  } catch (error) {
    console.error('Error deleting user:', error.message);
    res.status(500).send('Internal Server Error');
  }
})

app.post('/AutomaticUpdateReportStatus', async (req, res) => {
  try {
    const { reportId, status, reviewedby, reviewedat } = req.body;

    const updateReportStatusQuery = `
      UPDATE reports 
      SET status = ?, reviewedby = ?, reviewedat = ?
      WHERE id = ?
    `;
    
    await executeQuery(updateReportStatusQuery, [status, reviewedby, reviewedat, reportId]);

    res.status(200).send('Report status updated successfully');
  } catch (error) {
    console.error('Error updating report status:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/editReport', async (req, res) => {
  const { 
    id, 
    status, 
    assignedto, 
    instructions, 
    actionstaken, 
    resolutioneta, 
    resolutionnotes, 
    manufacture, 
    cost,
    product,
    username
  } = req.body;

  // Check required fields based on the status and selected user
  if (status === 'In Progress') {
    if (!assignedto) {
      return res.status(400).json({ error: 'Reports needs to be assigned.' });
    }
    // if (assignedto !== username) {
    //   return res.status(400).json({ error: 'Instructions are required for another user' });
    // }
    if (assignedto === username && (!actionstaken || !resolutioneta)) {
      return res.status(400).json({ error: 'Actions Taken and Resolution ETA are required for the current user' });
    }
  } else if (status === 'Resolved') {
    if (!assignedto || !resolutionnotes) {
      return res.status(400).json({ error: 'Assigned To and Resolution Notes are required for Resolved status' });
    }
  }

  // Validate paid services if necessary (this may no longer be needed if not using `paidServices`)
  // if (paidServices && (!manufacture || !cost)) {
  //   return res.status(400).json({ error: 'Manufacture and Cost are required if Paid Services is selected' });
  // }

  try {
    // SQL query to update the report
    const updateReportQuery = `
      UPDATE reports SET 
        status = ?, 
        assignedto = ?, 
        instructions = ?, 
        actionstaken = ?, 
        resolutioneta = ?, 
        resolutionnotes = ?, 
        manufacture = ?, 
        cost = ?,
        product = ?
      WHERE id = ?
    `;

    // Execute the query
    await executeQuery(updateReportQuery, [
      status,
      assignedto,
      instructions,
      actionstaken,
      resolutioneta,
      resolutionnotes,
      manufacture,
      cost,
      product,
      id
    ]);

    res.status(200).json({ message: 'Report updated successfully' });
  } catch (error) {
    console.error('Error updating report:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/eliminateReport', async (req, res) => {
  try {
    const { reportId } = req.body;

    const eliminateReportsQuery = `
      DELETE FROM reports WHERE id = ?
    `;

    await executeQuery(eliminateReportsQuery, [reportId]); 

    res.status(200).send('Report status updated successfully');
  } catch (error) {
    console.log('Error updating report status', error.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;

const port = 3306;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
