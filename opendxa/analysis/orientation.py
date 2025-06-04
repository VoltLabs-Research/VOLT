import numpy as np

def compute_orientation_azimuth(timesteps_data):
    angles = []
    for dislocs in timesteps_data.values():
        for d in dislocs:
            pts = np.array(d['points'])
            vec = pts[-1] - pts[0]
            angles.append(np.degrees(np.arctan2(vec[1], vec[0])))
    return angles

def compute_orientation_spherical(timesteps_data):
    orient = []
    for dislocs in timesteps_data.values():
        for d in dislocs:
            pts = np.array(d['points'])
            for i in range(len(pts)-1):
                seg = pts[i+1] - pts[i]
                mag = np.linalg.norm(seg)
                if mag < 1e-8:
                    continue
                costh = np.dot(seg, np.array([0,0,1])) / mag
                costh = np.clip(costh, -1.0, 1.0)
                theta = np.degrees(np.arccos(costh))
                phi = np.degrees(np.arctan2(seg[1], seg[0]))
                orient.append((theta, phi))
    return np.array(orient)
