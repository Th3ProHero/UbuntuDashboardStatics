import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Server, Box, Network, AlertTriangle, Cpu } from 'lucide-react';
import { io } from 'socket.io-client';
import Dashboard from './pages/Dashboard';
import DockerSection from './pages/DockerSection';
import ServicesMap from './pages/ServicesMap';
import ProcessExplorer from './pages/ProcessExplorer';
import Cloudflare from './pages/Cloudflare';
import { useStore } from './store';

// Connecting to the backend running on the same host
const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:9091' : '/');

function App() {
  const setMetrics = useStore((state) => state.setMetrics);
  const setContainers = useStore((state) => state.setContainers);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('metrics_update', (data) => {
      setMetrics(data);
    });

    socket.on('docker_update', (data) => {
      setContainers(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('metrics_update');
      socket.off('docker_update');
    };
  }, [setMetrics, setContainers]);

  return (
    <Router>
      <div className="flex h-screen bg-background text-slate-200 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 glass-panel m-4 flex flex-col z-10 border-r-0">
          <div className="p-6 flex items-center space-x-3 border-b border-panelBorder">
            <div className="w-8 h-8 rounded bg-accent flex items-center justify-center">
              <Server size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">NOC<span className="text-accent font-light">Dash</span></h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <NavItem to="/" icon={<Activity size={20} />} label="Main Dashboard" />
            <NavItem to="/docker" icon={<Box size={20} />} label="Docker Containers" />
            <NavItem to="/services" icon={<Network size={20} />} label="Services Map" />
            <NavItem to="/processes" icon={<Cpu size={20} />} label="Process Explorer" />
            <NavItem to="/cloudflare" icon={<Network size={20} />} label="Cloudflare" />
            {/* Additional Nav Items could go here */}
          </nav>

          <div className="p-4 border-t border-panelBorder text-xs text-slate-400 flex items-center justify-between">
            <span>System Status</span>
            <div className="flex items-center space-x-2">
              <span className={`status-dot ${isConnected ? 'healthy' : 'danger'}`}></span>
              <span>{isConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Topbar */}
          <header className="h-16 flex items-center justify-between px-8 z-10 mt-4 mr-4 glass-panel">
            <h2 className="text-lg font-medium text-slate-300">Unified Server Operations</h2>
            <div className="flex items-center space-x-4">
               <div className="relative">
                 <AlertTriangle size={20} className="text-slate-400 hover:text-warning cursor-pointer transition-colors" />
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full shadow-[0_0_5px_rgba(239,68,68,1)]"></span>
               </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-4 z-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/docker" element={<DockerSection />} />
              <Route path="/services" element={<ServicesMap />} />
              <Route path="/processes" element={<ProcessExplorer />} />
              <Route path="/cloudflare" element={<Cloudflare />} />
            </Routes>
          </main>
          
          {/* Background decoration */}
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>
        </div>
      </div>
    </Router>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        isActive 
          ? 'bg-accent/20 text-accent border border-accent/30' 
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
}

export default App;
