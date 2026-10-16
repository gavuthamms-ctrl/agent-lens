import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { GraphData, GraphNode, GraphEdge } from '../types';

interface AgentGraphProps {
  graphData: GraphData;
  theme: 'dark' | 'light';
  onNodeClick: (node: GraphNode) => void;
  onEdgeClick: (edge: GraphEdge) => void;
}

export const AgentGraph: React.FC<AgentGraphProps> = ({
  graphData,
  theme,
  onNodeClick,
  onEdgeClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [physicsEnabled, setPhysicsEnabled] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === 'dark';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const edgeColor = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';

    // Transform nodes
    const visNodes = graphData.nodes.map(node => {
      const hasDefect = node.defect_count > 0;
      const baseSize = 25;
      const dynamicSize = Math.min(50, baseSize + node.total_messages * 2.5);

      let bg = isDark ? '#1e293b' : '#f1f5f9';
      let border = isDark ? '#475569' : '#cbd5e1';

      if (hasDefect) {
        bg = isDark ? '#451a1a' : '#fee2e2';
        border = '#ef4444';
      } else if (node.is_bottleneck) {
        bg = isDark ? '#422006' : '#fef3c7';
        border = '#f59e0b';
      } else if (node.is_isolated) {
        bg = isDark ? '#334155' : '#e2e8f0';
        border = '#64748b';
      }

      return {
        id: node.id,
        label: `${node.label}\n(${node.role.slice(0, 24)}${node.role.length > 24 ? '...' : ''})`,
        value: dynamicSize,
        shape: 'dot',
        size: dynamicSize,
        color: {
          background: bg,
          border: border,
          highlight: {
            background: hasDefect ? '#dc2626' : '#6366f1',
            border: '#ffffff',
          },
        },
        borderWidth: hasDefect ? 3 : 2,
        shadow: hasDefect ? { enabled: true, color: '#ef4444', size: 10 } : false,
        font: {
          color: textColor,
          size: 13,
          face: 'Inter, sans-serif',
          multi: true,
          align: 'center',
        },
      };
    });

    // Transform edges
    const visEdges = graphData.edges.map(edge => {
      const hasDefect = edge.has_defects;
      const color = hasDefect ? '#ef4444' : edgeColor;
      const width = Math.min(7, 1.5 + edge.count * 0.7);

      return {
        id: edge.id,
        from: edge.from_node,
        to: edge.to_node,
        label: `${edge.count} msgs${hasDefect ? ' ⚠️' : ''}`,
        arrows: 'to',
        width: width,
        color: {
          color: color,
          highlight: hasDefect ? '#ef4444' : '#6366f1',
          hover: hasDefect ? '#ef4444' : '#6366f1',
        },
        font: {
          color: hasDefect ? '#ef4444' : isDark ? '#94a3b8' : '#64748b',
          size: 11,
          align: 'middle',
          background: isDark ? '#0f172a' : '#ffffff',
          strokeWidth: 0,
        },
        smooth: {
          type: 'curvedCW',
          roundness: 0.15,
        },
      };
    });

    const data = {
      nodes: new DataSet(visNodes),
      edges: new DataSet(visEdges),
    };

    const options = {
      physics: {
        enabled: physicsEnabled,
        barnesHut: {
          gravitationalConstant: -3500,
          centralGravity: 0.35,
          springLength: 140,
          springConstant: 0.04,
          damping: 0.09,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 150,
        navigationButtons: false,
        zoomView: true,
      },
    };

    if (networkRef.current) {
      networkRef.current.destroy();
    }

    const network = new Network(containerRef.current, data as any, options as any);
    networkRef.current = network;

    network.on('click', params => {
      if (params.nodes && params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const clickedNode = graphData.nodes.find(n => n.id === nodeId);
        if (clickedNode) onNodeClick(clickedNode);
      } else if (params.edges && params.edges.length > 0) {
        const edgeId = params.edges[0];
        const clickedEdge = graphData.edges.find(e => e.id === edgeId);
        if (clickedEdge) onEdgeClick(clickedEdge);
      }
    });

    network.once('stabilizationIterationsDone', () => {
      network.setOptions({ physics: { enabled: false } });
      setPhysicsEnabled(false);
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [graphData, theme]);

  const handleFit = () => {
    if (networkRef.current) {
      networkRef.current.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
    }
  };

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({
        scale: scale * 1.3,
        animation: { duration: 250, easingFunction: 'easeInOutQuad' },
      });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({
        scale: scale * 0.7,
        animation: { duration: 250, easingFunction: 'easeInOutQuad' },
      });
    }
  };

  const handleTogglePhysics = () => {
    if (!networkRef.current) return;
    const nextState = !physicsEnabled;
    setPhysicsEnabled(nextState);
    networkRef.current.setOptions({ physics: { enabled: nextState } });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px' }}>
      <div className="graph-toolbar" style={{ position: 'absolute', top: 12, right: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={handleFit} title="Fit to screen">
          ⊡ Fit
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleZoomIn} title="Zoom in">
          ➕
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleZoomOut} title="Zoom out">
          ➖
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleTogglePhysics}>
          {physicsEnabled ? '⚡ Physics: On' : '⚡ Physics: Off'}
        </button>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
