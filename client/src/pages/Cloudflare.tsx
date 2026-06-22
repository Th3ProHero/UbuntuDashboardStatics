import { useState, useEffect } from 'react';
import { Globe, Shield, AlertCircle, ChevronDown, ChevronRight, Server } from 'lucide-react';

const getApiUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:9091' : '';

export default function Cloudflare() {
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // DNS Records state
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<Record<string, any[]>>({});
  const [loadingDns, setLoadingDns] = useState<Record<string, boolean>>({});

  const toggleZone = async (zoneId: string) => {
    if (expandedZone === zoneId) {
      setExpandedZone(null);
      return;
    }
    
    setExpandedZone(zoneId);
    
    // Fetch if we haven't already
    if (!dnsRecords[zoneId]) {
      setLoadingDns(prev => ({ ...prev, [zoneId]: true }));
      try {
        const res = await fetch(`${getApiUrl()}/api/cloudflare/zones/${zoneId}/dns_records`);
        if (res.ok) {
          const data = await res.json();
          setDnsRecords(prev => ({ ...prev, [zoneId]: data }));
        }
      } catch (err) {
        console.error("Failed to load DNS records", err);
      } finally {
        setLoadingDns(prev => ({ ...prev, [zoneId]: false }));
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tunnelsRes, zonesRes] = await Promise.all([
          fetch(`${getApiUrl()}/api/cloudflare/tunnels`),
          fetch(`${getApiUrl()}/api/cloudflare/zones`)
        ]);

        if (!tunnelsRes.ok || !zonesRes.ok) {
          throw new Error('Failed to fetch Cloudflare data. Please check if API token is configured in .env');
        }

        const tData = await tunnelsRes.json();
        const zData = await zonesRes.json();

        setTunnels(tData.error ? [] : tData);
        setZones(zData.error ? [] : zData);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching Cloudflare data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400 animate-pulse">Loading Cloudflare Data...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-6 text-danger flex items-start gap-4">
          <AlertCircle size={24} className="shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Cloudflare Configuration Error</h3>
            <p className="text-danger/80">{error}</p>
            <p className="mt-4 text-sm text-danger/60">
              Make sure you have added `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the `.env` file and restarted the backend.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tunnels Section */}
        <div className="glass-panel p-6 flex flex-col h-[500px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded bg-accent/20 flex items-center justify-center text-accent">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-medium text-lg">Active Tunnels</h2>
              <p className="text-sm text-slate-400">Cloudflare Zero Trust Tunnels</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto pr-2">
            {tunnels.length === 0 ? (
              <div className="text-center text-slate-500 mt-10">No tunnels found.</div>
            ) : (
              <div className="space-y-4">
                {tunnels.map((tunnel) => (
                  <div key={tunnel.id} className="p-4 rounded-lg bg-white/5 border border-panelBorder hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-slate-200">{tunnel.name}</div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${tunnel.status === 'active' || tunnel.status === 'healthy' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                        {tunnel.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>ID:</span>
                        <span className="font-mono">{tunnel.id.substring(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{new Date(tunnel.created_at).toLocaleDateString()}</span>
                      </div>
                      {tunnel.connections && tunnel.connections.length > 0 && (
                        <div className="flex justify-between text-success">
                          <span>Connections:</span>
                          <span>{tunnel.connections.length} active</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Domains Section */}
        <div className="glass-panel p-6 flex flex-col h-[500px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="font-medium text-lg">Managed Domains</h2>
              <p className="text-sm text-slate-400">Cloudflare DNS Zones</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto pr-2">
            {zones.length === 0 ? (
              <div className="text-center text-slate-500 mt-10">No domains found.</div>
            ) : (
              <div className="space-y-4">
                {zones.map((zone) => (
                  <div key={zone.id} className="rounded-lg bg-white/5 border border-panelBorder overflow-hidden">
                    <div 
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => toggleZone(zone.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedZone === zone.id ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                        <div className="font-medium text-slate-200">{zone.name}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${zone.status === 'active' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                        {zone.status.toUpperCase()}
                      </span>
                    </div>
                    
                    {expandedZone === zone.id && (
                      <div className="p-4 pt-0 border-t border-white/5 bg-black/20">
                        <div className="text-xs text-slate-400 flex justify-between items-center mb-3 mt-3">
                          <span>Plan: {zone.plan?.name || 'Free'}</span>
                          <span>Dev Mode: <span className={zone.development_mode ? 'text-warning' : 'text-slate-500'}>{zone.development_mode ? 'ON' : 'OFF'}</span></span>
                        </div>
                        
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Server size={14} /> DNS Records
                          </h4>
                          {loadingDns[zone.id] ? (
                            <div className="text-xs text-slate-500 animate-pulse py-2">Loading records...</div>
                          ) : !dnsRecords[zone.id] || dnsRecords[zone.id].length === 0 ? (
                            <div className="text-xs text-slate-500 py-2">No DNS records found.</div>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {dnsRecords[zone.id].map(record => (
                                <div key={record.id} className="text-xs bg-white/5 p-2 rounded flex items-center justify-between group">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                      record.type === 'A' ? 'bg-blue-500/20 text-blue-400' :
                                      record.type === 'CNAME' ? 'bg-purple-500/20 text-purple-400' :
                                      record.type === 'TXT' ? 'bg-slate-500/20 text-slate-400' :
                                      'bg-gray-500/20 text-gray-400'
                                    }`}>
                                      {record.type}
                                    </span>
                                    <span className="font-medium text-slate-300 truncate max-w-[120px]" title={record.name}>{record.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-slate-400 font-mono text-[10px] truncate max-w-[100px]" title={record.content}>
                                      {record.content.length > 20 ? record.content.substring(0, 20) + '...' : record.content}
                                    </span>
                                    {record.proxied && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.8)]" title="Proxied by Cloudflare"></span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
