import numpy as np

def compute_tortuosity(timesteps_data):
    result = []
    for dislocs in timesteps_data.values():
        for d in dislocs:
            pts = np.array(d['points'])
            diffs = pts[1:] - pts[:-1]
            real_len = np.linalg.norm(diffs, axis=1).sum()
            end2end = np.linalg.norm(pts[-1] - pts[0])
            if end2end > 1e-8:
                result.append(real_len / end2end)
    return result

def compute_line_lengths(timesteps_data):
    result = []
    for t, dislocs in timesteps_data.items():
        for d in dislocs:
            pts = np.array(d['points'])
            diffs = pts[1:] - pts[:-1]
            length = np.linalg.norm(diffs, axis=1).sum()
            result.append((t, length))
    return result
