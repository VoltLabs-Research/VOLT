import plotly.graph_objects as go
import numpy as np

def plot_centroids_3d(centroids, burgers_labels=None):
    if burgers_labels is None:
        burgers_labels = np.zeros(len(centroids))
    trace = go.Scatter3d(
        x=centroids[:,0], y=centroids[:,1], z=centroids[:,2],
        mode='markers',
        marker=dict(size=4, color=burgers_labels, colorscale='Viridis', showscale=True)
    )
    fig = go.Figure(data=[trace])
    fig.update_layout(scene=dict(xaxis_title='X', yaxis_title='Y', zaxis_title='Z'), title='3D Centroids')
    return fig

def plot_dislocation_lines_3d(dislocs, color_by='burgers'):
    fig = go.Figure()
    for d in dislocs:
        pts = np.array(d['points'])
        x,y,z = pts[:,0], pts[:,1], pts[:,2]
        if color_by == 'burgers':
            color = '#' + ''.join([format(int(255*np.random.rand()), '02x') for _ in range(3)])
        else:
            color = 'blue'
        fig.add_trace(go.Scatter3d(x=x, y=y, z=z, mode='lines', line=dict(color=color, width=3)))
    fig.update_layout(scene=dict(xaxis_title='X', yaxis_title='Y', zaxis_title='Z'), title='3D Dislocation Lines')
    return fig