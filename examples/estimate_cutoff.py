import numpy as np
import opendxa

positions = [
    [0.0, 0.0, 0.0],
    [2.5, 0.0, 0.0],
    [0.0, 2.5, 0.0],
    [2.5, 2.5, 0.0],
]

cell = [
    [5.0, 0.0, 0.0],
    [0.0, 5.0, 0.0],
    [0.0, 0.0, 5.0]
]

cutoff = opendxa.estimate_cutoff(positions, cell)
print(f'Estimated cutoff: {cutoff:.3f} Å')