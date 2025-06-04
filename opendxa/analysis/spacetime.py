import numpy as np
import matplotlib.pyplot as plt

def compute_spacetime_heatmap(timesteps_data, num_z_bins=50, z_bounds=None):
    ts = sorted(timesteps_data.keys())
    if z_bounds is None:
        all_z = []
        for dislocs in timesteps_data.values():
            for d in dislocs:
                pts = np.array(d['points'])
                all_z.append(np.mean(pts[:,2]))
        z_lo, z_hi = min(all_z), max(all_z)
    else:
        z_lo, z_hi = z_bounds

    heat = np.zeros((len(ts), num_z_bins), dtype=int)
    for i, t in enumerate(ts):
        for d in timesteps_data[t]:
            pts = np.array(d['points'])
            cz = np.mean(pts[:,2])
            idx = int((cz - z_lo)/(z_hi - z_lo) * num_z_bins)
            idx = min(max(idx,0), num_z_bins-1)
            heat[i, idx] += 1
    return ts, (z_lo, z_hi), heat
