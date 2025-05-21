import React, { useState, useEffect, useRef, useCallback } from 'react';
import D3LineChart from './D3LineChart';
import * as idbService from './indexedDBService';
import './Dashboard.css'; // Import the CSS file

// Typy
interface DataPoint {
  timestamp: number;
  value: number;
  category: string;
}

interface DashboardProps {
  endpoint: string;
  refreshRate?: number; // Kept for prop compatibility, though not directly used by D3 chart refresh
}

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

const Dashboard: React.FC<DashboardProps> = ({ endpoint }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [jwtToken, setJwtToken] = useState<string>(localStorage.getItem('jwtToken') || '');
  const [tokenInput, setTokenInput] = useState<string>(jwtToken); // Initialize input with current token

  const retryCountRef = useRef<number>(0);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const reconnectTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);


  const clearReconnectTimer = () => {
    if (reconnectTimeoutIdRef.current) {
      clearTimeout(reconnectTimeoutIdRef.current);
      reconnectTimeoutIdRef.current = null;
    }
  };

  const connectWebSocket = useCallback(() => {
    if (!jwtToken) {
      setError('Please provide a JWT token to connect.');
      setIsConnected(false);
      if (socketRef.current) {
        socketRef.current.close(1000, 'JWT token removed');
        socketRef.current = null;
      }
      return;
    }

    if (!isOnline) {
      setError('Offline. Cannot connect to WebSocket.');
      setIsConnected(false);
      return;
    }
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected.');
      setIsConnected(true);
      return;
    }
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket connection attempt already in progress.');
      return;
    }
    
    setError(null);
    if (!isRetrying) {
      console.log(`Attempting to connect to WebSocket at ${endpoint} with token.`);
    }

    const wsUrl = `ws://${endpoint}?token=${jwtToken}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected successfully.');
      setIsConnected(true);
      setError(null);
      retryCountRef.current = 0;
      setIsRetrying(false);
      clearReconnectTimer();
    };
    
    ws.onmessage = (event) => {
      try {
        const messageData = JSON.parse(event.data as string);
        let newPoints: DataPoint[] = [];
        if (Array.isArray(messageData)) {
          newPoints = messageData.map(item => ({ 
            ...item, 
            timestamp: new Date(item.timestamp).getTime() 
          }));
        } else {
          newPoints.push({
            timestamp: new Date(messageData.timestamp || Date.now()).getTime(),
            value: messageData.value !== undefined ? messageData.value : Math.random() * 100,
            category: messageData.category || 'default',
            ...messageData
          });
        }
        setData(prevData => [...prevData, ...newPoints].sort((a,b) => a.timestamp - b.timestamp).slice(-1000)); // Keep last 1000 points
        if (isOnline) {
            idbService.addDataPoints(newPoints).catch(err => {
                console.error("Failed to cache data points:", err);
            });
        }
      } catch (err) {
        console.error('Failed to parse or process data:', err);
      }
    };

    const startRetrySequence = () => {
      if (isRetrying || !jwtToken || !isOnline) {
        if(!isOnline) console.log('Offline, not starting retry sequence.');
        setIsRetrying(false);
        return;
      }
      retryCountRef.current++;
      if (retryCountRef.current <= MAX_RETRIES) {
        setIsRetrying(true);
        const delay = INITIAL_RETRY_DELAY_MS * (2 ** (retryCountRef.current - 1));
        setError(`Connection lost. Attempting to reconnect... (Attempt ${retryCountRef.current} of ${MAX_RETRIES})`);
        console.log(`WebSocket: Reconnecting in ${delay / 1000}s (Attempt ${retryCountRef.current})`);
        clearReconnectTimer();
        reconnectTimeoutIdRef.current = setTimeout(() => {
          if(isRetrying) connectWebSocket();
        }, delay);
      } else {
        setError(`Failed to reconnect after ${MAX_RETRIES} attempts. Please check your connection or token.`);
        console.error(`WebSocket: Max retries (${MAX_RETRIES}) reached.`);
        setIsRetrying(false);
        retryCountRef.current = 0;
      }
    };
    
    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      if (!isRetrying && (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED)) {
         setError('WebSocket connection error. Check console for details.');
      }
      setIsConnected(false);
    };
    
    ws.onclose = (event) => {
      console.log(`Disconnected from WebSocket: Code ${event.code}, Reason: '${event.reason}', Clean: ${event.wasClean}`);
      setIsConnected(false);
      if (socketRef.current === ws) { // Ensure this onclose is for the current socket
        socketRef.current = null;
      }
      if (event.code === 1000 || event.code === 1008 || event.code === 4001) {
        if (event.code === 1008 || event.code === 4001) {
          setError('Connection closed due to authentication failure. Please check your JWT token.');
        } else if (!jwtToken){
           setError('Please provide a JWT token to connect.');
        }
        setIsRetrying(false);
        retryCountRef.current = 0;
        clearReconnectTimer();
        return;
      }
      if (jwtToken && isOnline) {
        startRetrySequence();
      } else if (!isOnline) {
        setError('Connection closed. Currently offline.');
      } else if (!jwtToken) {
         setError('Connection closed. Please provide a JWT token to connect.');
      }
    };
  }, [endpoint, jwtToken, isRetrying, isOnline]); // Removed connectWebSocket from here

  useEffect(() => {
    idbService.getAllDataPoints().then(cachedData => {
      if (cachedData && cachedData.length > 0) {
        setData(prevData => {
          const existingTimestamps = new Set(prevData.map(p => p.timestamp));
          const uniqueCachedData = cachedData.filter(p => !existingTimestamps.has(p.timestamp));
          console.log(`Loaded ${uniqueCachedData.length} new data points from IndexedDB.`);
          return [...uniqueCachedData, ...prevData].sort((a,b) => a.timestamp - b.timestamp).slice(-1000); // Keep last 1000 points
        });
      }
    }).catch(err => {
      console.error("Failed to load data from IndexedDB:", err);
    });

    const handleOnline = () => {
      console.log('Status: Online');
      setIsOnline(true);
      setError(null);
      if (!isConnected && !isRetrying && jwtToken) { // Connect if token exists
        retryCountRef.current = 0;
        connectWebSocket();
      }
    };
    const handleOffline = () => {
      console.log('Status: Offline');
      setIsOnline(false);
      setIsConnected(false);
      setError('Offline. Displaying cached data. Some features may be unavailable.');
      clearReconnectTimer();
      setIsRetrying(false);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close(1005, "Network connection lost"); // 1005 is "No Status Rcvd" but often used for this
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (isOnline && jwtToken) { // Connect on initial load if online and token exists
      connectWebSocket();
    } else if (!jwtToken) {
        setError("Please provide a JWT token to connect.");
    } else if (!isOnline) {
      setError("Currently offline. Displaying cached data if available.");
    }

    return () => {
      console.log('Dashboard component unmounting. Cleaning up WebSocket, timers, and event listeners.');
      clearReconnectTimer();
      if (socketRef.current) {
        socketRef.current.onclose = null; 
        socketRef.current.onerror = null;
        socketRef.current.onmessage = null;
        socketRef.current.onopen = null;
        if(socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
           socketRef.current.close(1000, "Component unmounting"); 
        }
        socketRef.current = null;
      }
      setIsConnected(false);
      setIsRetrying(false);
      retryCountRef.current = 0;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [jwtToken, endpoint, connectWebSocket, isOnline]); // Added connectWebSocket and isOnline


  const handleSetToken = () => {
    clearReconnectTimer(); 
    setIsRetrying(false); 
    retryCountRef.current = 0; 
    if (socketRef.current) {
      socketRef.current.onclose = null; // Avoid onclose firing and triggering retries
      socketRef.current.close(1000, "Token changed"); 
      socketRef.current = null;
    }
    localStorage.setItem('jwtToken', tokenInput);
    setJwtToken(tokenInput); 
    // The useEffect hook watching jwtToken will call connectWebSocket
  };

  const handleManualRetry = () => {
    if (isRetrying || !isOnline) {
      if(!isOnline) setError("Cannot retry: Currently offline.");
      return;
    }
    console.log('Manual retry initiated.');
    clearReconnectTimer();
    retryCountRef.current = 0; 
    setIsRetrying(false); 
    if (socketRef.current && socketRef.current.readyState === WebSocket.CLOSED) {
        socketRef.current = null;
    }
    connectWebSocket(); 
  };
  
  // Render dashboard
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Real-time Analytics Dashboard</h1>
        <div className="status-indicators">
          <span>Network: {isOnline ? <span className="online">Online</span> : <span className="offline">Offline</span>}</span>
          <span>WebSocket: {isConnected ? <span className="connected">Connected</span> : <span className="disconnected">Disconnected</span>}</span>
        </div>
      </header>

      <div className="controls">
        <input 
          type="text" 
          value={tokenInput} 
          onChange={(e) => setTokenInput(e.target.value)} 
          placeholder="Enter JWT Token" 
        />
        <button onClick={handleSetToken}>Set Token & Connect</button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          {/* Show retry button only if there's a token, not connected, not already retrying AND online */}
          {!isConnected && jwtToken && isOnline && !isRetrying && ( 
            <button 
              onClick={handleManualRetry} 
              disabled={isRetrying} // Kept for safety, though covered by outer !isRetrying
            >
              Retry Connection
            </button>
          )}
           {isRetrying && jwtToken && isOnline && (
             <button disabled={true}>Retrying...</button>
           )}
        </div>
      )}
      
      <div className="chart-container">
        {data.length > 0 ? (
            <D3LineChart data={data} />
        ) : (
          <p>No data to display. Waiting for WebSocket messages, ensure token is set, or check connection.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;