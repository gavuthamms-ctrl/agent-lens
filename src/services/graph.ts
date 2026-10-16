import { AgentSchema, MessageSchema, DefectSchema, GraphData, GraphNode, GraphEdge } from '../types';

export class GraphService {
  public static analyze(
    agents: AgentSchema[],
    messages: MessageSchema[],
    defects: DefectSchema[]
  ): GraphData {
    const agentRoleMap: Record<string, string> = {};
    for (const a of agents) {
      agentRoleMap[a.name] = a.role;
    }

    const allNodeIds = new Set<string>();
    for (const a of agents) {
      allNodeIds.add(a.name);
    }

    const sentCounts: Record<string, number> = {};
    const receivedCounts: Record<string, number> = {};
    const edgeMessages: Map<string, number[]> = new Map();

    for (const id of allNodeIds) {
      sentCounts[id] = 0;
      receivedCounts[id] = 0;
    }

    for (const msg of messages) {
      const sender = msg.sender.trim();
      const receiver = msg.receiver.trim();

      if (!sender || !receiver) continue;

      if (!allNodeIds.has(sender)) {
        allNodeIds.add(sender);
        sentCounts[sender] = 0;
        receivedCounts[sender] = 0;
      }
      if (!allNodeIds.has(receiver)) {
        allNodeIds.add(receiver);
        sentCounts[receiver] = 0;
        receivedCounts[receiver] = 0;
      }

      sentCounts[sender] = (sentCounts[sender] || 0) + 1;
      receivedCounts[receiver] = (receivedCounts[receiver] || 0) + 1;

      const edgeKey = `${sender}-->${receiver}`;
      if (!edgeMessages.has(edgeKey)) {
        edgeMessages.set(edgeKey, []);
      }
      edgeMessages.get(edgeKey)!.push(msg.id);
    }

    const nodeList = Array.from(allNodeIds);
    const n = nodeList.length;

    // Directed adjacency list
    const adj: Map<string, Set<string>> = new Map();
    for (const id of nodeList) {
      adj.set(id, new Set());
    }
    for (const edgeKey of edgeMessages.keys()) {
      const [u, v] = edgeKey.split('-->');
      adj.get(u)?.add(v);
    }

    // Degree centrality: (inDegree + outDegree) / (2 * (n - 1))
    const degreeCentrality: Record<string, number> = {};
    for (const u of nodeList) {
      const outDeg = adj.get(u)?.size || 0;
      let inDeg = 0;
      for (const v of nodeList) {
        if (adj.get(v)?.has(u)) inDeg++;
      }
      degreeCentrality[u] = n > 1 ? Number(((inDeg + outDeg) / (2 * (n - 1))).toFixed(3)) : 0;
    }

    // Betweenness centrality: Brandes' algorithm for directed graphs
    const betweenness: Record<string, number> = {};
    for (const u of nodeList) {
      betweenness[u] = 0;
    }

    if (n > 2) {
      for (const s of nodeList) {
        const stack: string[] = [];
        const pred: Map<string, string[]> = new Map();
        const sigma: Map<string, number> = new Map();
        const dist: Map<string, number> = new Map();

        for (const v of nodeList) {
          pred.set(v, []);
          sigma.set(v, 0);
          dist.set(v, -1);
        }

        sigma.set(s, 1);
        dist.set(s, 0);

        const queue: string[] = [s];
        while (queue.length > 0) {
          const v = queue.shift()!;
          stack.push(v);
          const neighbors = adj.get(v) || new Set();

          for (const w of neighbors) {
            // Path discovery
            if (dist.get(w)! < 0) {
              dist.set(w, dist.get(v)! + 1);
              queue.push(w);
            }
            // Path counting
            if (dist.get(w)! === dist.get(v)! + 1) {
              sigma.set(w, sigma.get(w)! + sigma.get(v)!);
              pred.get(w)!.push(v);
            }
          }
        }

        const delta: Map<string, number> = new Map();
        for (const v of nodeList) {
          delta.set(v, 0);
        }

        while (stack.length > 0) {
          const w = stack.pop()!;
          for (const v of pred.get(w)!) {
            const coeff = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
            delta.set(v, delta.get(v)! + coeff);
          }
          if (w !== s) {
            betweenness[w] += delta.get(w)!;
          }
        }
      }

      // Normalization: 1 / ((n-1)(n-2))
      const scale = 1 / ((n - 1) * (n - 2));
      for (const u of nodeList) {
        betweenness[u] = Number((betweenness[u] * scale).toFixed(3));
      }
    }

    // Bottlenecks & Isolated
    const bottleneckAgents: string[] = [];
    if (nodeList.length > 0) {
      const bVals = Object.values(betweenness);
      const maxB = bVals.length > 0 ? Math.max(...bVals) : 0;
      for (const u of nodeList) {
        const b = betweenness[u] || 0;
        if (b >= 0.3 || (maxB > 0.2 && b === maxB && n >= 3)) {
          bottleneckAgents.push(u);
        }
      }
    }

    const isolatedAgents = nodeList.filter(
      u => (sentCounts[u] || 0) === 0 && (receivedCounts[u] || 0) === 0
    );

    // Cycle detection using DFS
    const detectedCycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const parentMap: Map<string, string> = new Map();

    const dfsCycle = (curr: string, path: string[]) => {
      visited.add(curr);
      recStack.add(curr);

      const neighbors = adj.get(curr) || new Set();
      for (const next of neighbors) {
        if (!visited.has(next)) {
          parentMap.set(next, curr);
          dfsCycle(next, [...path, next]);
        } else if (recStack.has(next)) {
          // Found cycle
          const cycleIdx = path.indexOf(next);
          if (cycleIdx !== -1) {
            const cycle = path.slice(cycleIdx);
            if (cycle.length >= 2 && detectedCycles.length < 10) {
              // Avoid duplicates
              const sortedStr = [...cycle].sort().join(',');
              if (!detectedCycles.some(c => [...c].sort().join(',') === sortedStr)) {
                detectedCycles.push(cycle);
              }
            }
          }
        }
      }

      recStack.delete(curr);
    };

    for (const u of nodeList) {
      if (!visited.has(u)) {
        dfsCycle(u, [u]);
      }
    }

    // Map defects to nodes and edges
    const nodeDefects: Record<string, number> = {};
    for (const u of nodeList) {
      nodeDefects[u] = 0;
    }

    const msgToEdge: Map<number, string> = new Map();
    const edgeDefects: Map<string, Set<string>> = new Map();
    for (const [edgeKey, msgIds] of edgeMessages.entries()) {
      edgeDefects.set(edgeKey, new Set());
      for (const mId of msgIds) {
        msgToEdge.set(mId, edgeKey);
      }
    }

    for (const d of defects) {
      for (const ag of d.agents) {
        if (nodeDefects[ag] !== undefined) {
          nodeDefects[ag]++;
        }
      }
      for (const mId of d.message_ids) {
        if (msgToEdge.has(mId)) {
          const edgeKey = msgToEdge.get(mId)!;
          edgeDefects.get(edgeKey)?.add(d.type);
        }
      }
    }

    // Build GraphNodes
    const nodesOut: GraphNode[] = nodeList.map(id => {
      const s = sentCounts[id] || 0;
      const r = receivedCounts[id] || 0;
      return {
        id,
        label: id,
        role: agentRoleMap[id] || 'Collaborating Agent',
        sent_count: s,
        received_count: r,
        total_messages: s + r,
        defect_count: nodeDefects[id] || 0,
        betweenness: betweenness[id] || 0,
        degree_centrality: degreeCentrality[id] || 0,
        is_bottleneck: bottleneckAgents.includes(id),
        is_isolated: isolatedAgents.includes(id),
      };
    });

    // Build GraphEdges
    const edgesOut: GraphEdge[] = [];
    for (const [edgeKey, msgIds] of edgeMessages.entries()) {
      const [u, v] = edgeKey.split('-->');
      const dTypes = Array.from(edgeDefects.get(edgeKey) || []);
      edgesOut.push({
        id: `${u}->${v}`,
        from_node: u,
        to_node: v,
        count: msgIds.length,
        message_ids: msgIds,
        defect_count: dTypes.length,
        has_defects: dTypes.length > 0,
        defect_types: dTypes,
      });
    }

    const totalPossibleEdges = n > 1 ? n * (n - 1) : 1;
    const density = Number((edgesOut.length / totalPossibleEdges).toFixed(3));

    return {
      nodes: nodesOut,
      edges: edgesOut,
      cycles_detected: detectedCycles,
      isolated_agents: isolatedAgents,
      bottleneck_agents: bottleneckAgents,
      density,
      total_messages: messages.length,
    };
  }
}
