// import './App.css'; // Removed default Vite App.css as Dashboard.css handles specific styles
import Dashboard from './components/Dashboard';

function App() {
  // The Dashboard component will now construct its WebSocket URL
  // relative to its own origin, to be handled by Vite's proxy.
  // No endpoint prop is needed here anymore.
  return (
    <div className="App">
      <Dashboard />
    </div>
  );
}

export default App;
