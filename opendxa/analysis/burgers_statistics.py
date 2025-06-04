from collections import defaultdict
from fractions import Fraction
import numpy as np

# TODO: DUPLICATED CODE
def burgers_to_string(bvec):
    fracs = [Fraction(b).limit_denominator(6) for b in bvec]
    dens = [f.denominator for f in fracs]
    common = np.lcm.reduce(dens)
    nums = [int(f * common) for f in fracs]
    return f'1/{common}[{nums[0]} {nums[1]} {nums[2]}]'


def compute_burgers_histogram(timesteps_data):
    hist = defaultdict(int)
    total_loops = 0
    for dislocs in timesteps_data.values():
        for d in dislocs:
            key = burgers_to_string(d['matched_burgers'])
            hist[key] += 1
            total_loops += 1
    return hist, total_loops
