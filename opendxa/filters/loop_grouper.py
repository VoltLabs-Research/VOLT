import numpy as np

# Groups loops that are similar spatially and in the Burgers direction.
class LoopGrouper:
    def __init__(self, burgers_vectors, loops, positions, distance_threshold=5.0, angular_threshold=0.1):
        self.burgers = burgers_vectors
        self.loops = loops
        self.positions = np.asarray(positions, dtype=np.float32)
        self.dist_thresh = distance_threshold
        self.angle_thresh = angular_threshold

    def group_loops(self):
        grouped = []
        used = set()

        def are_similar(i, j):
            b1 = self.burgers[i] / np.linalg.norm(self.burgers[i])
            b2 = self.burgers[j] / np.linalg.norm(self.burgers[j])
            angle_sim = np.dot(b1, b2) > (1 - self.angle_thresh)
            pts1 = self.positions[self.loops[i]]
            pts2 = self.positions[self.loops[j]]
            center1 = np.mean(pts1, axis=0)
            center2 = np.mean(pts2, axis=0)
            dist = np.linalg.norm(center1 - center2)
            return angle_sim and dist < self.dist_thresh

        for i in range(len(self.loops)):
            if i in used:
                continue
            group = [i]
            used.add(i)
            for j in range(i + 1, len(self.loops)):
                if j in used:
                    continue
                if are_similar(i, j):
                    group.append(j)
                    used.add(j)
            grouped.append(group)

        return grouped