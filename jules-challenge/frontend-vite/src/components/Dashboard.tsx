import React, { useState, useEffect, useRef, useCallback } from 'react';
import D3LineChart from './D3LineChart';
import * as idbService from '../services/indexedDBService';
import './Dashboard.css'; // Import the CSS file

// Typy
interface DataPoint {
  timestamp: number;
  value: number;
  category: string;
}

interface DashboardProps {
  // endpoint prop is no longer needed as WebSocket URL is constructed relative to window.location
  refreshRate?: number; 
}

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

const Dashboard: React.FC<DashboardProps> = ({ refreshRate }) => { // Removed endpoint from props
  const [data, setData] = useState<DataPoint[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [jwtToken, setJwtToken] = useState<string>(localStorage.getItem('jwtToken') || '');
  const [tokenInput, setTokenInput] = useState<string>(jwtToken);

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
      // Construct the WebSocket URL relative to the current host, using /ws path for proxy
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host; // Vite dev server host (e.g., localhost:5173)
      const proxiedWsUrl = `${wsProtocol}//${wsHost}/ws?token=${jwtToken}`; // Path /ws will be proxied
      console.log(`Attempting to connect to WebSocket at ${proxiedWsUrl}`);
    }

    // Construct the WebSocket URL for proxy
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws?token=${jwtToken}`; // Path /ws will be proxied
    
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
        setData(prevData => [...prevData, ...newPoints].sort((a,b) => a.timestamp - b.timestamp).slice(-1000)); // Keep last 1000 points for performance
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
          if(isRetrying) connectWebSocket(); // Check isRetrying again before connecting
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
      setIsConnected(false); // This might trigger onclose
    };
    
    ws.onclose = (event) => {
      console.log(`Disconnected from WebSocket: Code ${event.code}, Reason: '${event.reason}', Clean: ${event.wasClean}`);
      setIsConnected(false);
      if (socketRef.current === ws) { // Process onclose only if it's for the current socket instance
        socketRef.current = null;
      
        if (event.code === 1000 || event.code === 1008 || event.code === 4001) { // Normal closure or auth failure
          if (event.code === 1008 || event.code === 4001) {
            setError('Connection closed due to authentication failure. Please check your JWT token.');
          } else if (!jwtToken){ // Normal closure but no token
             setError('Please provide a JWT token to connect.');
          }
          setIsRetrying(false);
          retryCountRef.current = 0;
          clearReconnectTimer();
          return;
        }
        // For other codes, if online and token exists, attempt retry
        if (jwtToken && isOnline) {
          startRetrySequence();
        } else if (!isOnline) {
          setError('Connection closed. Currently offline.');
        } else if (!jwtToken) { // Should be caught above, but as a fallback
           setError('Connection closed. Please provide a JWT token to connect.');
        }
      }
    };
  // }, [endpoint, jwtToken, isRetrying, isOnline]); // endpoint removed from dependencies
  }, [jwtToken, isRetrying, isOnline, connectWebSocket]); // connectWebSocket added for its stable ref

  useEffect(() => {
    idbService.getAllDataPoints().then(cachedData => {
      if (cachedData && cachedData.length > 0) {
        setData(prevData => {
          const existingTimestamps = new Set(prevData.map(p => p.timestamp));
          const uniqueCachedData = cachedData.filter(p => !existingTimestamps.has(p.timestamp));
          console.log(`Loaded ${uniqueCachedData.length} new data points from IndexedDB.`);
          return [...uniqueCachedData, ...prevData].sort((a,b) => a.timestamp - b.timestamp).slice(-1000);
        });
      }
    }).catch(err => {
      console.error("Failed to load data from IndexedDB:", err);
    });

    const handleOnline = () => {
      console.log('Status: Online');
      setIsOnline(true);
      setError(null);
      if (!isConnected && !isRetrying && jwtToken) {
        retryCountRef.current = 0;
        connectWebSocket();
      }
    };
    const handleOffline = () => {
      console.log('Status: Offline');
      setIsOnline(false);
      setIsConnected(false); // WebSocket connection will be lost or is already lost
      setError('Offline. Displaying cached data. Some features may be unavailable.');
      clearReconnectTimer(); // Stop any reconnection attempts
      setIsRetrying(false);
      // WebSocket connection will be closed by the browser or by its own error/close handlers
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (isOnline && jwtToken) {
      connectWebSocket();
    } else if (!jwtToken) {
        setError("Please provide a JWT token to connect.");
    } else if (!isOnline) {
      setError("Currently offline. Displaying cached data if available.");
    }

    return () => {
      console.log('Dashboard component unmounting. Cleaning up.');
      clearReconnectTimer();
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        if(socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
           socketRef.current.close(1000, "Component unmounting"); 
        }
        socketRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // }, [jwtToken, endpoint, connectWebSocket, isOnline]); // endpoint removed
  }, [jwtToken, connectWebSocket, isOnline]); // Removed endpoint from dependencies


  const handleSetToken = () => {
    clearReconnectTimer(); 
    setIsRetrying(false); 
    retryCountRef.current = 0; 
    if (socketRef.current) {
      socketRef.current.onclose = null; // Prevent onclose from triggering retries during manual token set
      socketRef.current.close(1000, "Token changed"); 
      socketRef.current = null;
    }
    localStorage.setItem('jwtToken', tokenInput);
    setJwtToken(tokenInput); 
    // The useEffect watching jwtToken will call connectWebSocket if conditions are met
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
        socketRef.current = null; // Clear closed socket ref to allow new connection
    }
    connectWebSocket(); 
  };
  
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
          {!isConnected && jwtToken && isOnline && !isRetrying && ( 
            <button 
              onClick={handleManualRetry} 
              disabled={isRetrying} 
            >
              Retry Connection
            </button>
          )}
           {isRetrying && jwtToken && isOnline && ( // Show "Retrying..." text/button if actively retrying
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