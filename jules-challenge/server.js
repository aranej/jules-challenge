// Základný skeleton pre backend

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const url = require('url'); // Needed for parsing URL query parameters

// --- JWT Authentication ---
const JWT_SECRET = 'your-super-secret-key-for-jwt'; // Store this securely in production!
let users = []; // In-memory user store (for simplicity)

// Middleware to parse JSON bodies
// Základný setup
const app = express();
app.use(express.json()); // Add this line
const server = http.createServer(app);

// --- Redis Client Setup ---
const redisClient = new Redis({
  // Default connection options (host: '127.0.0.1', port: 6379)
  // Add error handling for production (e.g., maxRetriesPerRequest)
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
  // In a real app, you might want to implement a strategy to handle this,
  // like serving data from DB only, or attempting to reconnect.
});

const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false,
  maxPayload: 1024 * 1024, // 1MB limit for message size
});

// WebSocket handling pre 10k connections
// JWT autentifikácia je implementovaná nižšie
// Redis Cache je implementovaný pre /api/data
// Retry mechanizmus je implementovaný a demonštrovaný nižšie

// --- Generic Retry Mechanism ---
const connectWithRetry = async (connectFn, serviceName = 'service', maxRetries = 5, initialDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to connect to ${serviceName}, attempt ${attempt}...`);
      const result = await connectFn();
      console.log(`Successfully connected to ${serviceName}.`);
      return result; // Successful connection
    } catch (error) {
      console.warn(`Failed to connect to ${serviceName} on attempt ${attempt}: ${error.message}`);
      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} attempts to connect to ${serviceName} failed.`);
        throw new Error(`Failed to connect to ${serviceName} after ${maxRetries} attempts: ${error.message}`);
      }
      const delay = initialDelay * (2 ** (attempt -1)); // Exponential backoff
      console.log(`Waiting ${delay}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// --- Placeholder DB Connection Simulation ---
let dbConnectionSuccessful = false; // To track if DB connection was successful for server startup logic

// --- In-memory stores for API data and config ---
let historicalDataStore = [
  { id: 1, timestamp: new Date(Date.now() - 100000).toISOString(), value: Math.random() * 100, device: 'sensor-alpha' },
  { id: 2, timestamp: new Date(Date.now() - 50000).toISOString(), value: Math.random() * 100, device: 'sensor-beta' },
  { id: 3, timestamp: new Date().toISOString(), value: Math.random() * 100, device: 'sensor-alpha' },
];

let currentConfig = {
  threshold: 75.5,
  isActive: true,
  notificationEmail: 'admin@example.com',
  allowedDevices: ['sensor-alpha', 'sensor-beta', 'sensor-gamma'],
};


const simulateDbConnection = async () => {
  // Simulate connection attempt (e.g., 50% success rate)
  if (Math.random() < 0.5) {
    // Simulate failure
    throw new Error("Simulated DB Connection Failure");
  }
  // Simulate success
  dbConnectionSuccessful = true; // Mark as successful
  return { status: "connected", dbName: "simulatedDB" };
};


// --- HTTP Authentication Middleware ---
const authenticateTokenHTTP = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // if no token, unauthorized

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // if token is invalid, forbidden
    req.user = user;
    next(); // proceed to the protected route
  });
};

// --- Auth Endpoints ---
app.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  // In a real app, hash password before storing
  const userExists = users.find(u => u.username === username);
  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }
  const newUser = { id: users.length + 1, username, password }; // Simple ID generation
  users.push(newUser);
  
  const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '1h' });
  res.status(201).json({ accessToken: token });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || user.password !== password) { // In a real app, compare hashed passwords
    return res.status(401).json({ message: "Invalid credentials" });
  }
  
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ accessToken: token });
});

// Základná REST API
const API_DATA_CACHE_KEY = 'api:data'; // This key might need to be user-specific if data is user-specific
const CACHE_EXPIRATION_SECONDS = 60;

app.get('/api/data', authenticateTokenHTTP, async (req, res) => { // Secure this route & make async
  try {
    const cachedData = await redisClient.get(API_DATA_CACHE_KEY);
    if (cachedData) {
      console.log(`User ${req.user.username} serving /api/data from cache`);
      return res.json(JSON.parse(cachedData));
    }

    console.log(`User ${req.user.username} serving /api/data from source (historicalDataStore)`);
    // Vrátiť historické dáta from historicalDataStore
    const sourceData = historicalDataStore; // Using the actual in-memory store
    
    await redisClient.set(API_DATA_CACHE_KEY, JSON.stringify(sourceData), 'EX', CACHE_EXPIRATION_SECONDS);
    
    res.json(sourceData);
  } catch (error) {
    console.error('Error in /api/data handler:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// New GET endpoint for configuration
app.get('/api/config', authenticateTokenHTTP, (req, res) => {
  console.log(`User ${req.user.username} requested configuration.`);
  res.json(currentConfig);
});

app.post('/api/config', authenticateTokenHTTP, (req, res) => { // Secure this route
  // Konfigurácia - Update currentConfig
  const newConfig = req.body;
  if (typeof newConfig !== 'object' || newConfig === null) {
    return res.status(400).json({ message: "Invalid configuration format. Expected an object." });
  }

  // Merge newConfig into currentConfig (simple merge, for complex objects, a deep merge might be needed)
  currentConfig = { ...currentConfig, ...newConfig };
  
  console.log(`User ${req.user.username} updated configuration. New config:`, currentConfig);
  res.json({ message: `Konfigurácia uložená pre používateľa ${req.user.username}`, updatedConfig: currentConfig });
});

// WebSocket handler
wss.on('connection', (ws, req) => { // req is available here
  const requestUrl = url.parse(req.url, true);
  const token = requestUrl.query.token;

  if (!token) {
    console.log('WS connection rejected: No token provided.');
    ws.terminate(); // Close connection if no token
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('WS connection rejected: Invalid token.');
      ws.terminate(); // Close connection if token is invalid
      return;
    }

    ws.user = decoded; // Store user info on the WebSocket connection object
    console.log(`Client connected: ${ws.user.username}`);
    
    ws.on('message', (message) => {
      // console.log('Received:', message); // Comment out for performance under load
      // TODO: Spracovať message (e.g., check ws.user for authorization)
    });
    
    ws.on('close', () => {
      console.log(`Client disconnected: ${ws.user ? ws.user.username : 'Unknown'}`);
      // TODO: Cleanup resources
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${ws.user ? ws.user.username : 'Unknown'}:`, error);
      // TODO: Implement more robust error handling
    });
  });
});

// --- Server Startup Logic ---
const startServer = async () => {
  try {
    // Attempt to connect to the simulated DB with retry
    await connectWithRetry(simulateDbConnection, 'SimulatedDB', 3, 500); // Shorter retries for demo
    console.log("Simulated DB connection process completed.");
    // Proceed with server start only if critical connections (like DB) are up, or handle gracefully.
    // For this demo, we'll log the status.
    if (dbConnectionSuccessful) {
      console.log("Simulated DB connection was successful. Starting server.");
    } else {
      console.warn("Simulated DB connection failed after retries. Server will start, but DB might be unavailable.");
    }

  } catch (error) {
    console.error("Failed to initialize critical services:", error.message);
    // Decide if server should start or exit. For this demo, we'll let it start.
    // process.exit(1); // Optionally exit if critical services fail
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer(); // Call the async function to start the server