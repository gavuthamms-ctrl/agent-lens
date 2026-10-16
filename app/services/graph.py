"""Network graph analysis service using NetworkX for multi-agent traces."""
from typing import List, Dict, Set, Any
import networkx as nx

from app.schemas import (
    GraphData,
    GraphNode,
    GraphEdge,
    MessageSchema,
    AgentSchema,
    DefectSchema,
)


class GraphService:
    """Constructs and analyzes the directed communication graph of agents."""

    @staticmethod
    def analyze(
        agents: List[AgentSchema],
        messages: List[MessageSchema],
        defects: List[DefectSchema],
    ) -> GraphData:
        """Build directed multigraph and calculate centrality, bottleneck, and defect metrics."""
        G = nx.MultiDiGraph()
        simple_G = nx.DiGraph()  # For cycle and centrality calculations

        # Ensure all registered agents are nodes in the graph
        agent_role_map = {a.name: a.role for a in agents}
        for agent in agents:
            G.add_node(agent.name, role=agent.role)
            simple_G.add_node(agent.name)

        # Track message communication edges: (sender, receiver) -> list of message IDs
        edge_messages: Dict[tuple, List[int]] = {}
        sent_counts: Dict[str, int] = {a.name: 0 for a in agents}
        received_counts: Dict[str, int] = {a.name: 0 for a in agents}

        for msg in messages:
            sender = msg.sender.strip()
            receiver = msg.receiver.strip()

            if sender not in sent_counts:
                sent_counts[sender] = 0
                G.add_node(sender, role=agent_role_map.get(sender, "Agent"))
                simple_G.add_node(sender)
            if receiver not in received_counts:
                received_counts[receiver] = 0
                G.add_node(receiver, role=agent_role_map.get(receiver, "Agent"))
                simple_G.add_node(receiver)

            sent_counts[sender] += 1
            received_counts[receiver] += 1

            pair = (sender, receiver)
            if pair not in edge_messages:
                edge_messages[pair] = []
            edge_messages[pair].append(msg.id)

            G.add_edge(sender, receiver, msg_id=msg.id)

        # Build weighted simple directed graph for centrality and cycle detection
        for (u, v), msg_ids in edge_messages.items():
            simple_G.add_edge(u, v, weight=len(msg_ids))

        # Compute centrality metrics
        num_nodes = simple_G.number_of_nodes()
        if num_nodes > 1:
            try:
                betweenness = nx.betweenness_centrality(simple_G, weight="weight")
            except Exception:
                betweenness = {n: 0.0 for n in simple_G.nodes()}

            try:
                degree_centrality = nx.degree_centrality(simple_G)
            except Exception:
                degree_centrality = {n: 0.0 for n in simple_G.nodes()}
        else:
            betweenness = {n: 0.0 for n in simple_G.nodes()}
            degree_centrality = {n: 0.0 for n in simple_G.nodes()}

        # Bottlenecks: agents with high betweenness centrality (e.g. > 0.35 or top 1 if betweenness > 0.2)
        bottleneck_agents: List[str] = []
        if betweenness:
            max_b = max(betweenness.values())
            for n, b in betweenness.items():
                if b >= 0.3 or (max_b > 0.2 and b == max_b and num_nodes >= 3):
                    bottleneck_agents.append(n)

        # Isolated agents: agents with 0 sent and 0 received messages
        isolated_agents: List[str] = [
            n for n in simple_G.nodes()
            if sent_counts.get(n, 0) == 0 and received_counts.get(n, 0) == 0
        ]

        # Cycle detection
        detected_cycles: List[List[str]] = []
        try:
            cycles = list(nx.simple_cycles(simple_G))
            # Keep cycles with length >= 2
            detected_cycles = [c for c in cycles if len(c) >= 2][:10]
        except Exception:
            detected_cycles = []

        # Map defects to nodes and edges
        node_defects: Dict[str, int] = {n: 0 for n in simple_G.nodes()}
        edge_defects: Dict[tuple, List[str]] = {pair: [] for pair in edge_messages.keys()}

        # Build message ID to edge mapping
        msg_to_pair: Dict[int, tuple] = {}
        for pair, msg_ids in edge_messages.items():
            for m_id in msg_ids:
                msg_to_pair[m_id] = pair

        for d in defects:
            for ag in d.agents:
                if ag in node_defects:
                    node_defects[ag] += 1
            for m_id in d.message_ids:
                if m_id in msg_to_pair:
                    pair = msg_to_pair[m_id]
                    if pair in edge_defects and d.type.value not in edge_defects[pair]:
                        edge_defects[pair].append(d.type.value)

        # Prepare GraphNode list
        nodes_out: List[GraphNode] = []
        for n in simple_G.nodes():
            s_c = sent_counts.get(n, 0)
            r_c = received_counts.get(n, 0)
            nodes_out.append(
                GraphNode(
                    id=n,
                    label=n,
                    role=agent_role_map.get(n, "Collaborator"),
                    sent_count=s_c,
                    received_count=r_c,
                    total_messages=s_c + r_c,
                    defect_count=node_defects.get(n, 0),
                    betweenness=round(betweenness.get(n, 0.0), 3),
                    degree_centrality=round(degree_centrality.get(n, 0.0), 3),
                    is_bottleneck=(n in bottleneck_agents),
                    is_isolated=(n in isolated_agents),
                )
            )

        # Prepare GraphEdge list
        edges_out: List[GraphEdge] = []
        for (u, v), m_ids in edge_messages.items():
            d_types = edge_defects.get((u, v), [])
            edges_out.append(
                GraphEdge(
                    id=f"{u}->{v}",
                    from_node=u,
                    to_node=v,
                    count=len(m_ids),
                    message_ids=m_ids,
                    defect_count=len(d_types),
                    has_defects=(len(d_types) > 0),
                    defect_types=d_types,
                )
            )

        # Calculate graph density
        try:
            density = round(nx.density(simple_G), 3)
        except Exception:
            density = 0.0

        return GraphData(
            nodes=nodes_out,
            edges=edges_out,
            cycles_detected=detected_cycles,
            isolated_agents=isolated_agents,
            bottleneck_agents=bottleneck_agents,
            density=density,
            total_messages=len(messages),
        )
