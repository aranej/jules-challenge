// Základný skeleton pre backend

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');

// Základný setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// TODO: Implementovať WebSocket handling pre 10k connections
// TODO: Implementovať JWT autentifikáciu
// TODO: Implementovať Redis Cache
// TODO: Implementovať retry mechanizmus

// Základná REST API
app.get('/api/data', (req, res) => {
  // TODO: Vrátiť historické dáta
  res.json({ message: "Tu budú historické dáta" });
});

app.post('/api/config', (req, res) => {
  // TODO: Konfigurácia
  res.json({ message: "Konfigurácia uložená" });
});

// Základný WebSocket handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    console.log('Received:', message);
    // TODO: Spracovať message
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    // TODO: Cleanup resources
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});