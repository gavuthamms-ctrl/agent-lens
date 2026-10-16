/**
 * AgentLens Graph Visualizer using vis-network
 */
class AgentGraphVisualizer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.network = null;
    this.data = null;
    this.physicsEnabled = true;
    this.onNodeClickCallback = null;
    this.onEdgeClickCallback = null;
  }

  setCallbacks(onNodeClick, onEdgeClick) {
    this.onNodeClickCallback = onNodeClick;
    this.onEdgeClickCallback = onEdgeClick;
  }

  render(graphData) {
    if (!this.container) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const edgeColor = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';

    // Transform nodes
    const nodes = graphData.nodes.map(node => {
      const hasDefect = node.defect_count > 0;
      const baseSize = 25;
      const dynamicSize = Math.min(50, baseSize + (node.total_messages * 2.5));

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
        raw: node,
      };
    });

    // Transform edges
    const edges = graphData.edges.map(edge => {
      const hasDefect = edge.has_defects;
      const color = hasDefect ? '#ef4444' : edgeColor;
      const width = Math.min(7, 1.5 + (edge.count * 0.7));

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
          color: hasDefect ? '#ef4444' : (isDark ? '#94a3b8' : '#64748b'),
          size: 11,
          align: 'middle',
          background: isDark ? '#0f172a' : '#ffffff',
          strokeWidth: 0,
        },
        smooth: {
          type: 'curvedCW',
          roundness: 0.15,
        },
        raw: edge,
      };
    });

    const data = {
      nodes: new vis.DataSet(nodes),
      edges: new vis.DataSet(edges),
    };
    this.data = data;

    const options = {
      physics: {
        enabled: this.physicsEnabled,
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

    if (this.network) {
      this.network.destroy();
    }

    this.network = new vis.Network(this.container, data, options);

    // Event listeners
    this.network.on('click', params => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const clickedNode = graphData.nodes.find(n => n.id === nodeId);
        if (this.onNodeClickCallback) this.onNodeClickCallback(clickedNode);
      } else if (params.edges.length > 0) {
        const edgeId = params.edges[0];
        const clickedEdge = graphData.edges.find(e => e.id === edgeId);
        if (this.onEdgeClickCallback) this.onEdgeClickCallback(clickedEdge);
      }
    });

    // Automatically stabilize and relax physics after initial burst
    this.network.once('stabilizationIterationsDone', () => {
      this.network.setOptions({ physics: { enabled: false } });
      this.physicsEnabled = false;
      const toggleBtn = document.getElementById('btn-toggle-physics');
      if (toggleBtn) toggleBtn.innerHTML = '⚡ Physics: Off';
    });
  }

  fit() {
    if (this.network) {
      this.network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
    }
  }

  zoomIn() {
    if (!this.network) return;
    const scale = this.network.getScale();
    this.network.moveTo({ scale: scale * 1.3, animation: { duration: 250 } });
  }

  zoomOut() {
    if (!this.network) return;
    const scale = this.network.getScale();
    this.network.moveTo({ scale: scale * 0.7, animation: { duration: 250 } });
  }

  togglePhysics() {
    if (!this.network) return;
    this.physicsEnabled = !this.physicsEnabled;
    this.network.setOptions({ physics: { enabled: this.physicsEnabled } });
    const toggleBtn = document.getElementById('btn-toggle-physics');
    if (toggleBtn) {
      toggleBtn.innerHTML = this.physicsEnabled ? '⚡ Physics: On' : '⚡ Physics: Off';
    }
  }
}

window.AgentGraphVisualizer = AgentGraphVisualizer;
