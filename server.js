const express = require('express');
const path = require('path');

// Create an instance of Express
const app = express();

// Define the port the server will listen on
const PORT = process.env.PORT || 3000;

// Serve static files from the `public` directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
