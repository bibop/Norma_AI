const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 9090;

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.url}`);
  
  // Parse the URL and remove query parameters
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Map URL path to file path
  let filePath = '';
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'norma_ai_frontend/public/direct-test.html');
    console.log(`Attempting to serve: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      res.writeHead(404);
      res.end('File not found. The direct-test.html file does not exist at the expected location.');
      return;
    }
  } else {
    // Serve other files from public directory
    filePath = path.join(__dirname, 'norma_ai_frontend/public', pathname);
    console.log(`Attempting to serve: ${filePath}`);
  }

  // Get the file extension
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  
  // Set content type based on file extension
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
  }

  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      console.error(`Error reading file: ${error.code}`);
      if (error.code === 'ENOENT') {
        // File not found
        res.writeHead(404);
        res.end(`File not found: ${filePath}`);
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      console.log(`Successfully serving file: ${filePath}`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Serving files from: ${path.join(__dirname, 'norma_ai_frontend/public')}`);
  
  // Check if the direct-test.html file exists
  const testFilePath = path.join(__dirname, 'norma_ai_frontend/public/direct-test.html');
  if (fs.existsSync(testFilePath)) {
    console.log(` direct-test.html file found at: ${testFilePath}`);
  } else {
    console.error(` direct-test.html file NOT found at: ${testFilePath}`);
  }
});
