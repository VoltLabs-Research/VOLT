import numpy as np
import networkx as nx

def build_dislocation_graph(dislocs, tol=1e-3):
    G = nx.Graph()
    def round_pt(pt):
        return tuple(np.round(pt / tol) * tol)

    for d in dislocs:
        pts = np.array(d['points'])
        prev_node = None
        for p in pts:
            node = round_pt(p)
            G.add_node(node)
            if prev_node is not None:
                G.add_edge(prev_node, node)
            prev_node = node
    return G

def analyze_graph_topology(G):
    components = list(nx.connected_components(G))
    c = len(components)
    degrees = [deg for _, deg in G.degree()]
    mean_deg = np.mean(degrees) if degrees else 0.0
    E = G.number_of_edges()
    V = G.number_of_nodes()
    num_cycles = E - V + c
    degree_dist = np.bincount(degrees) if degrees else np.array([0])
    return {
        'num_components': c,
        'num_cycles': num_cycles,
        'mean_degree': mean_deg,
        'degree_distribution': degree_dist
    }

def compute_graph_spectrum(G):
    L = nx.laplacian_matrix(G).astype(float).toarray()
    eigs = np.linalg.eigvalsh(L)
    return np.sort(eigs)
