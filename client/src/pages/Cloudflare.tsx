import { useState, useEffect } from 'react';
import { Globe, Shield, AlertCircle } from 'lucide-react';

const getApiUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:9091' : '';

export default function Cloudflare() {
  const [tunnels, setTunnels] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                  <div key={zone.id} className="p-4 rounded-lg bg-white/5 border border-panelBorder hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium text-slate-200">{zone.name}</div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${zone.status === 'active' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                        {zone.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex justify-between items-center">
                      <span>Plan: {zone.plan?.name || 'Free'}</span>
                      <span>Dev Mode: <span className={zone.development_mode ? 'text-warning' : 'text-slate-500'}>{zone.development_mode ? 'ON' : 'OFF'}</span></span>
                    </div>
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
