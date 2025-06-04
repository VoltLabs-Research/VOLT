import matplotlib.pyplot as plt
import numpy as np

def plot_voxel_density_map(counts, grid_size, title='Voxel Density'):
    nx, ny, nz = grid_size
    mat = np.zeros((nx, ny, nz), dtype=int)
    for (i,j,k), c in counts.items():
        mat[i,j,k] = c
    # Plot central z-slice
    z0 = nz // 2
    plt.figure(figsize=(5,4))
    plt.imshow(mat[:,:,z0].T, origin='lower')
    plt.colorbar(label='Count')
    plt.title(f'{title} (slice z={z0})')
    plt.xlabel('i (x)')
    plt.ylabel('j (y)')
    plt.tight_layout()
    return plt

def plot_voxel_line_length_map(densities, axis='z', slice_index=None):
    nx, ny, nz = densities.shape
    if slice_index is None:
        slice_index = {'x':nx//2, 'y':ny//2, 'z':nz//2}[axis]
    if axis == 'z':
        mat2d = densities[:,:,slice_index]
        xlabel, ylabel = 'i (x)', 'j (y)'
    elif axis == 'y':
        mat2d = densities[:,slice_index,:]
        xlabel, ylabel = 'i (x)', 'k (z)'
    else:
        mat2d = densities[slice_index,:,:]
        xlabel, ylabel = 'j (y)', 'k (z)'

    plt.figure(figsize=(5,4))
    plt.imshow(mat2d.T, origin='lower')
    plt.colorbar(label='Total line length')
    plt.xlabel(xlabel)
    plt.ylabel(ylabel)
    plt.title(f'Line Length Density (slice {axis}={slice_index})')
    plt.tight_layout()
    return plt