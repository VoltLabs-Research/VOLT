import numpy as np

def track_dislocations(timesteps_data, tol=1e-2, dist_tol=5.0):
    tracks = []
    last_frame = {}
    for t in sorted(timesteps_data.keys()):
        current_frame = {}
        for d in timesteps_data[t]:
            bvec = tuple(np.round(d['matched_burgers'], 4))
            center = np.mean(d['points'], axis=0)
            matched = False
            for key, (lb, lc) in last_frame.items():
                if np.allclose(bvec, lb, atol=tol) and np.linalg.norm(center - lc) < dist_tol:
                    current_frame[key] = (bvec, center, d)
                    matched = True
                    break
            if not matched:
                key = len(tracks)
                tracks.append({})
                current_frame[key] = (bvec, center, d)
            tracks[key][t] = d
        last_frame = {k:(b,c) for k,(b,c,d) in current_frame.items()}
    return tracks
