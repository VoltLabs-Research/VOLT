import numpy as np
from collections import defaultdict

def segments_to_plane_histogram(dislocs, plane_normals, angle_tol=5.0):
    counts = defaultdict(int)
    for d in dislocs:
        pts = np.array(d['points'])
        for i in range(len(pts)-1):
            seg = pts[i+1] - pts[i]
            norm = np.linalg.norm(seg)
            if norm < 1e-8:
                continue
            seg_norm = seg / norm
            for label, n in plane_normals.items():
                n_unit = n / np.linalg.norm(n)
                angle = np.degrees(np.arccos(abs(np.dot(seg_norm, n_unit))))
                if abs(angle - 90.0) <= angle_tol:
                    counts[label] += 1
                    break
    return counts
