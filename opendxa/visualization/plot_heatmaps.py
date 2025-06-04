import matplotlib.pyplot as plt

def plot_spacetime_heatmap(ts, z_bounds, heat):
    z_lo, z_hi = z_bounds
    plt.figure(figsize=(8,6))
    plt.imshow(
        heat.T,
        origin='lower',
        aspect='auto',
        extent=[ts[0], ts[-1], z_lo, z_hi]
    )
    plt.colorbar(label='Number of lines')
    plt.xlabel('Timestep')
    plt.ylabel('Z coordinate')
    plt.title('Spacetime Heatmap')
    plt.tight_layout()
    return plt