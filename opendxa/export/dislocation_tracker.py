from collections import defaultdict
from fractions import Fraction
from matplotlib.ticker import MaxNLocator
import matplotlib.pyplot as plt
import numpy as np
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