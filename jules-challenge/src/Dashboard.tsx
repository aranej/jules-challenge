// Základný skeleton pre React frontend (TypeScript)
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Typy
interface DataPoint {
  timestamp: number;
  value: number;
  category: string;
}

interface DashboardProps {
  endpoint: string;
  refreshRate?: number;
}

// Hlavný dashboard komponent
const Dashboard: React.FC<DashboardProps> = ({ endpoint, refreshRate = 1000 }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  // TODO: Implementuj WebSocket connection
  // TODO: Implementuj offline mode
  // TODO: Implementuj error recovery
  // TODO: Implementuj JWT auth
  
  useEffect(() => {
    // Setup WebSocket connection
    const ws = new WebSocket(endpoint);
    
    ws.onopen = () => {
      console.log('Connected to WebSocket');
      setIsConnected(true);
      setError(null);
    };
    
    ws.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        // TODO: Spracovať dáta a updatovať state
        setData(prevData => [...prevData, newData]);
      } catch (err) {
        console.error('Failed to parse data:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Failed to connect to the server');
      setIsConnected(false);
      // TODO: Implementuj retry logiku
    };
    
    ws.onclose = () => {
      console.log('Disconnected from WebSocket');
      setIsConnected(false);
      // TODO: Implementuj reconnect logiku
    };
    
    setSocket(ws);
    
    // Cleanup function
    return () => {
      ws.close();
    };
  }, [endpoint]);
  
  // Render dashboard
  return (
    <div className="dashboard">
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => {/* TODO: Implement retry */}}>
            Retry Connection
          </button>
        </div>
      )}
      
      <header>
        <h1>Real-time Analytics Dashboard</h1>
        <div className="connection-status">
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </header>
      
      <div className="chart-container">
        <LineChart width={800} height={400} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }} 
          />
        </LineChart>
      </div>
      
      {/* TODO: Implementovať ďalšie vizualizácie a komponenty */}
    </div>
  );
};

export default Dashboard;