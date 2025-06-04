import networkx as nx
import matplotlib.pyplot as plt

def plot_networkx_graph(G, title='Dislocation Graph'):
    plt.figure(figsize=(6,6))
    # XY Projection
    pos = {n: (n[0], n[1]) for n in G.nodes()}
    nx.draw(G, pos, node_size=10, edge_color='gray')
    plt.title(title)
    plt.axis('equal')
    return plt