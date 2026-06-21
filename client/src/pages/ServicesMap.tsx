import { useMemo } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store';

export default function ServicesMap() {
  const containers = useStore(state => state.containers);

  // Auto-generate topology based on containers
  const { nodes, edges } = useMemo(() => {
    const defaultNodes: Node[] = [
      {
        id: 'host',
        type: 'default',
        data: { label: 'Ubuntu Server (Host)' },
        position: { x: 400, y: 50 },
        style: {
          background: 'rgba(20, 20, 25, 0.8)',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '10px 20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          fontWeight: 'bold',
        }
      }
    ];

    const defaultEdges: Edge[] = [];

    // Layout simply in a semi-circle or grid below the host
    const radius = 300;
    const centerX = 400;
    const centerY = 350;

    containers.forEach((c, index) => {
      const angle = (Math.PI / (containers.length + 1)) * (index + 1);
      const x = centerX - radius * Math.cos(angle);
      const y = centerY - radius * Math.sin(angle);

      const isRunning = c.state === 'running';
      const color = isRunning ? '#10b981' : '#ef4444';

      defaultNodes.push({
        id: c.id,
        data: { 
          label: (
            <div className="flex flex-col items-center">
              <span className="font-medium">{c.name}</span>
              <span className="text-[10px] opacity-70 mt-1">{c.ports.join(', ')}</span>
            </div>
          )
        },
        position: { x, y },
        style: {
          background: 'rgba(30, 30, 40, 0.9)',
          color: '#fff',
          border: `1px solid ${color}`,
          borderRadius: '8px',
          padding: '10px',
          minWidth: '120px',
          textAlign: 'center',
          boxShadow: `0 0 10px ${isRunning ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
        }
      });

      defaultEdges.push({
        id: `e-host-${c.id}`,
        source: 'host',
        target: c.id,
        animated: isRunning,
        style: { stroke: isRunning ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)' }
      });
    });

    return { nodes: defaultNodes, edges: defaultEdges };
  }, [containers]);

  return (
    <div className="glass-panel h-[calc(100vh-120px)] w-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-panelBorder bg-white/5">
        <h2 className="font-medium text-lg">Services Topology Map</h2>
        <p className="text-xs text-slate-400 mt-1">Visual representation of running Docker services and their exposed ports.</p>
      </div>
      <div className="flex-1 w-full bg-black/20">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="#ffffff" gap={16} style={{ opacity: 0.05 }} />
          <Controls className="bg-panel border border-panelBorder fill-white" />
        </ReactFlow>
      </div>
    </div>
  );
}
