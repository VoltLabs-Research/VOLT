from collections import defaultdict
from fractions import Fraction
from matplotlib.ticker import MaxNLocator
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt
import numpy as np
import networkx as nx
import json
import os

class DislocationTracker:
    def __init__(self, directory='dislocations'):
        self.directory = directory
        self.timesteps_data = {}

    def load_all_timesteps(self):
        for filename in sorted(os.listdir(self.directory)):
            if filename.startswith('timestep_') and filename.endswith('.json'):
                timestep = int(filename.split('_')[1].split('.')[0])
                with open(os.path.join(self.directory, filename)) as f:
                    data = json.load(f)
                    self.timesteps_data[timestep] = data['dislocations']

    def compute_centroids(self):
        '''
        Returns a list of tuples (timestep, [centroids of each line at that timestep]).
        '''
        result = []
        for t, dislocs in self.timesteps_data.items():
            centroids = []
            for d in dislocs:
                pts = np.array(d['points'])
                centroids.append(np.mean(pts, axis=0))
            result.append((t, np.array(centroids)))  # shape (num_lines, 3)
        return result

    def voxel_density(self, grid_size=(10, 10, 10), box_bounds=None):
        '''
        Calculates the line density per voxel in a 3D grid for all timesteps.
        Args:
            grid_size (tuple of int): Number of cells in (nx, ny, nz) for the box.
            box_bounds (list of [lo, hi]): If provided, defines the box's bounds
            as [[xlo, xhi], [ylo, yhi], [zlo, zhi]].
            Otherwise, the unit value [0, 1]³ is assumed.
        Returns:
            dict: { (i, j, k): count_total } counting all lines in that cell.
        '''
        nx, ny, nz = grid_size
        if box_bounds is None:
            box_bounds = [[0, 1], [0, 1], [0, 1]]

        counts = defaultdict(int)
        for t, dislocs in self.timesteps_data.items():
            for d in dislocs:
                pts = np.array(d['points'])
                cen = np.mean(pts, axis=0)  # [x,y,z]
                # Normalizar según los bounds
                xi = int((cen[0] - box_bounds[0][0]) / (box_bounds[0][1] - box_bounds[0][0]) * nx)
                yi = int((cen[1] - box_bounds[1][0]) / (box_bounds[1][1] - box_bounds[1][0]) * ny)
                zi = int((cen[2] - box_bounds[2][0]) / (box_bounds[2][1] - box_bounds[2][0]) * nz)
                # Limitar índices al rango [0, n-1]
                xi = min(max(xi, 0), nx-1)
                yi = min(max(yi, 0), ny-1)
                zi = min(max(zi, 0), nz-1)
                counts[(xi, yi, zi)] += 1
        return counts

    def cluster_centroids(self, n_clusters=3):
        '''
        Applies K-means to all centroids (without discriminating timesteps) to
        detect dense spatial regions of dislocations.

        Args:
            n_clusters (int): Number of clusters in K-means.
            
        Returns:
            KMeans object: Fitted to the centroids.
            np.ndarray: Array of shape (total_centroids, 3) containing all centroids.

        np.ndarray: Cluster labels associated with each centroid.
        '''
        centroids_all = []
        for _, dislocs in self.timesteps_data.items():
            for d in dislocs:
                pts = np.array(d['points'])
                centroids_all.append(np.mean(pts, axis=0))
        centroids_all = np.array(centroids_all)  # forma (N_total, 3)

        if centroids_all.size == 0:
            raise ValueError('No centroids found for clustering.')

        kmeans = KMeans(n_clusters=n_clusters)
        labels = kmeans.fit_predict(centroids_all)
        return kmeans, centroids_all, labels
    
    def compute_tortuosity(self):
        '''
        For each dislocation line at each timestep, calculate the tortuosity:
        tortuosity = (actual length) / (direct distance between endpoints).

        Returns:
        list of float: Tortuosity values for all lines.
        '''
        tortuosities = []
        for dislocs in self.timesteps_data.values():
            for d in dislocs:
                pts = np.array(d['points'])
                diffs = pts[1:] - pts[:-1]
                real_length = np.linalg.norm(diffs, axis=1).sum()
                end_to_end = np.linalg.norm(pts[-1] - pts[0])
                if end_to_end > 1e-8:
                    tort = real_length / end_to_end
                    tortuosities.append(tort)
        return tortuosities
    
    def build_dislocation_graph(self, timestep: int):
        '''
        For a given timestep, construct a graph (NetworkX) where vertices
        are points (rounded to a certain tolerance) and edges correspond
        to segments between consecutive points on the same line.

        Args:
        timestep (int): Timestep to analyze.

        Returns:
        networkx.Graph: Dislocation graph.
        '''
        G = nx.Graph()
        dislocs = self.timesteps_data.get(timestep, [])
        tol = 1e-3  # tolerancia para considerar dos puntos iguales

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

    def analyze_graph_topology(self, timestep: int):
        '''
        Calculates topological statistics for the dislocation graph in a timestep:
        - Number of connected components
        - Number of cycles (closed circuits)
        - Average degree of the nodes
        - Degree distribution

        Args:
        timestep (int): Timestep to analyze.

        Returns:
        dict: Topological statistics.
        '''
        G = self.build_dislocation_graph(timestep)
        components = list(nx.connected_components(G))
        num_components = len(components)
        degrees = [deg for _, deg in G.degree()]
        mean_degree = np.mean(degrees) if degrees else 0
        # Estimated cycles: |E| - |V| + |C| (Euler formula for planar graphs, approximate)
        num_edges = G.number_of_edges()
        num_nodes = G.number_of_nodes()
        num_cycles = num_edges - num_nodes + num_components

        stats = {
            'num_components': num_components,
            'num_cycles': num_cycles,
            'mean_degree': mean_degree,
            'degree_distribution': np.bincount(degrees) if degrees else np.array([0])
        }
        return stats
    
    def plot_tortuosity_histogram(self, bins=50):
        '''
        Displays a tortuosity histogram.

        Args:
            bins (int): Number of bins for the histogram. Defaults to 50.

        Returns:
            None: Displays the figure.
        '''
        torts = self.compute_tortuosity()
        if not torts:
            print('No lines were found to calculate tortuosity.')
            return

        plt.figure()
        plt.hist(torts, bins=bins)
        plt.title('Dislocation Tortuosity Histogram')
        plt.xlabel('Tortuosity (Real length / End-to-end distance)')
        plt.ylabel('Frequency')
        plt.tight_layout()
        plt.show()

    def compute_orientation_histogram(self, bins=36):
        '''
        Calculates a histogram of the orientations (in degrees) of each line using the direct 
        vector (end point - start point). The angle is measured with respect to the x-axis in 
        the xy plane (azimuth) or can be extended to 3D with full polar/azimuth.

        Args:
            bins (int): Number of angular bins for the histogram. Defaults to 36.

        Returns:
            None: Displays the histogram.
        '''
        angles = []
        for dislocs in self.timesteps_data.values():
            for d in dislocs:
                pts = np.array(d['points'])
                vec = pts[-1] - pts[0]
                theta = np.degrees(np.arctan2(vec[1], vec[0]))
                angles.append(theta)

        if not angles:
            print('No lines were found to analyze orientation.')
            return

        plt.figure()
        plt.hist(angles, bins=bins, range=(-180, 180))
        plt.title('Dislocation Orientation (Azimuth) Histogram')
        plt.xlabel('Angle (degrees)')
        plt.ylabel('Frequency')
        plt.tight_layout()
        plt.show()
    
    def plot_spacetime_heatmap(self, num_z_bins=50, z_bounds=None):
        '''
        Constructs and displays a heat map where the x-axis is the timestep
        and the y-axis is the position along z (in bins). The color indicates
        how many lines have their centroid in that z-range for each timestep.

        Args:
            num_z_bins (int): Number of cells along z. Defaults to 50.
            z_bounds (Optional[list of 2 floats]): [z_lo, z_hi] of the box. If None,
                                                    infers [min_z, max_z]
                                                    across all centroids.

        Returns:
            None: Displays the heat map.
        '''
        timesteps = sorted(self.timesteps_data.keys())

        if z_bounds is None:
            all_z = []
            for dislocs in self.timesteps_data.values():
                for d in dislocs:
                    pts = np.array(d['points'])
                    cen_z = pts[:, 2].mean()
                    all_z.append(cen_z)
            z_lo, z_hi = min(all_z), max(all_z)
        else:
            z_lo, z_hi = z_bounds

        heatmap = np.zeros((len(timesteps), num_z_bins), dtype=int)

        for i, t in enumerate(timesteps):
            for d in self.timesteps_data[t]:
                pts = np.array(d['points'])
                cen_z = pts[:, 2].mean()
                # Calcular índice de bin
                bin_index = int((cen_z - z_lo) / (z_hi - z_lo) * num_z_bins)
                bin_index = min(max(bin_index, 0), num_z_bins - 1)
                heatmap[i, bin_index] += 1

        plt.figure(figsize=(8, 6))
        plt.imshow(
            heatmap.T,
            aspect='auto',
            origin='lower',
            extent=[timesteps[0], timesteps[-1], z_lo, z_hi]
        )
        plt.colorbar(label='Number of dislocation lines')
        plt.xlabel('Timestep')
        plt.ylabel('Z coordinate')
        plt.title('Spacetime Heatmap of Dislocation Centroids')
        plt.tight_layout()
        plt.show()

    def track_dislocations(self):
        # Naive tracking based on Burgers vector and centroid proximity
        tracks = []
        last_frame = {}

        for t in sorted(self.timesteps_data):
            current_frame = {}
            for disloc in self.timesteps_data[t]:
                bvec = tuple(np.round(disloc['matched_burgers'], 4))
                center = np.mean(disloc['points'], axis=0)
                matched = False
                for key, (last_bvec, last_center) in last_frame.items():
                    if np.allclose(bvec, last_bvec, atol=1e-2) and np.linalg.norm(np.array(center) - np.array(last_center)) < 5.0:
                        current_frame[key] = (bvec, center)
                        matched = True
                        break
                if not matched:
                    key = len(tracks)
                    tracks.append({})
                    current_frame[key] = (bvec, center)
                tracks[key][t] = disloc
            last_frame = current_frame
        return tracks

    def segments_to_plane_histogram(self, timestep: int, plane_normals: dict, angle_tol=5.0):
        '''
        Counts, for each line segment in a given timestep, which 
        crystallographic plane it is closest to (based on the angle with the normal).

        Args:
            timestep (int): Timestep to analyze.
            plane_normals (dict): Maps plane label (e.g., '111') to the normal np.array([1,1,1]).
            angle_tol (float): Tolerance in degrees for considering a segment in the plane.

        Returns:
            dict: {plane_label: count_of_segments}.
        '''
        counts = defaultdict(int)
        dislocs = self.timesteps_data.get(timestep, [])
        for d in dislocs:
            pts = np.array(d['points'])
            for i in range(len(pts) - 1):
                seg = pts[i+1] - pts[i]
                seg_norm = seg / np.linalg.norm(seg)
                for label, normal in plane_normals.items():
                    n = normal / np.linalg.norm(normal)
                    angle = np.degrees(np.arccos(abs(np.dot(seg_norm, n))))
                    # almost perpendicular to the normal
                    if abs(angle - 90.0) <= angle_tol:
                        counts[label] += 1
                        break
        return counts
    
    def compute_statistics(self):
        burgers_hist = defaultdict(int)
        total_count = 0
        total_loops = 0
        for t, dislocs in self.timesteps_data.items():
            total_loops += len(dislocs)
            for d in dislocs:
                key = self.burgers_to_string(d['matched_burgers'])
                burgers_hist[key] += 1
                total_count += 1

        print('Dislocation Statistics')
        print('----------------------')
        print(f'Total timesteps: {len(self.timesteps_data)}')
        print(f'Total dislocation lines: {total_loops}')
        print('Histogram of Burgers vectors:')
        for k, v in sorted(burgers_hist.items(), key=lambda x: -x[1]):
            print(f'  {k}: {v}')

    def plot_burgers_histogram(self):
        burgers_hist = defaultdict(int)
        for dislocs in self.timesteps_data.values():
            for d in dislocs:
                key = self.burgers_to_string(d['matched_burgers'])
                burgers_hist[key] += 1

        labels = list(burgers_hist.keys())
        counts = [burgers_hist[k] for k in labels]

        fig, ax = plt.subplots()
        ax.bar(range(len(labels)), counts, tick_label=labels)
        plt.rcParams.update({'font.size': 14, 'font.family': 'serif'})
        ax.set_title('Burgers Vector Histogram')
        ax.set_ylabel('Count')
        ax.set_xlabel('Burgers Vector')
        ax.xaxis.set_major_locator(MaxNLocator(integer=True))
        plt.xticks(rotation=90)
        plt.tight_layout()
        plt.show()

    def burgers_to_string(self, bvec: list[float]) -> str:
        fractions = [Fraction(b).limit_denominator(6) for b in bvec]
        denominators = [f.denominator for f in fractions]
        common_den = np.lcm.reduce(denominators)
        numerators = [int(f * common_den) for f in fractions]
        return f'1/{common_den}[{numerators[0]} {numerators[1]} {numerators[2]}]'