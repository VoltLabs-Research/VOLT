import matplotlib.pyplot as plt
import numpy as np

class DislocationVTKReader:
    def __init__(self, vtk_file, colors=['green']):
        self.vtk_file = vtk_file
        self.points = []
        self.lines = []
        self.point_data = {}
        self.colors = colors

        self.read_vtk()

    def plot_dislocations(self, save_file=None, show_points=False):
        if len(self.points) == 0:
            print('There is no data to display.')
            return
        plt.style.use('default')
        fig = plt.figure(figsize=(12, 9), facecolor='white')
        ax = fig.add_subplot(111, projection='3d')

        # White background
        ax.xaxis.pane.fill = False
        ax.yaxis.pane.fill = False
        ax.zaxis.pane.fill = False
        ax.xaxis.pane.set_edgecolor('none')
        ax.yaxis.pane.set_edgecolor('none') 
        ax.zaxis.pane.set_edgecolor('none')
        ax.grid(False)

        for i, line_indices in enumerate(self.lines):
            if len(line_indices) > 1:
                line_points = self.points[line_indices]
                color = self.colors[i % len(self.colors)]
                ax.plot(line_points[:, 0], line_points[:, 1], line_points[:, 2],
                        color=color, linewidth=4, alpha=0.9, solid_capstyle='round')
        
        if show_points:
            critical_points = []
            for line_indices in self.lines:
                if len(line_indices) > 1:
                    critical_points.extend([line_indices[0], line_indices[-1]])
            
            if critical_points:
                critical_coords = self.points[list(set(critical_coords))]
                ax.scatter(critical_coords[:, 0], critical_coords[:, 1], critical_coords[:, 2],
                          c='#2C3E50', s=30, alpha=0.8, edgecolors='white', linewidth=1)
                
        ax.set_xlabel('X (Å)', fontsize=10, color='#34495E')
        ax.set_ylabel('Y (Å)', fontsize=10, color='#34495E')
        ax.set_zlabel('Z (Å)', fontsize=10, color='#34495E')

        ax.tick_params(axis='x', colors='#7F8C8D', labelsize=8)
        ax.tick_params(axis='y', colors='#7F8C8D', labelsize=8)
        ax.tick_params(axis='z', colors='#7F8C8D', labelsize=8)

        if len(self.points) > 0:
            center = np.mean(self.points, axis=0)
            max_range = np.max(np.ptp(self.points, axis=0)) / 2
            
            ax.set_xlim(center[0] - max_range, center[0] + max_range)
            ax.set_ylim(center[1] - max_range, center[1] + max_range)
            ax.set_zlim(center[2] - max_range, center[2] + max_range)
        
        ax.view_init(elev=20, azim=45)
        plt.tight_layout()

        if save_file:
            plt.savefig(save_file, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
            return
        plt.show()

    def plot_projections(self, save_file=None):
        if len(self.points) == 0:
            print('There is no data to display.')
            return
        fig, axes = plt.subplots(1, 3, figsize=(15, 3), facecolor='white')
        projections = [
            (0, 1, 'XY'),
            (0, 2, 'XZ'), 
            (1, 2, 'YZ')
        ]

        for idx, (x_idx, y_idx, label) in enumerate(projections):
            ax = axes[idx]
            for i, line_indices in enumerate(self.lines):
                if len(line_indices) > 1:
                    line_points = self.points[line_indices]
                    color = self.colors[i % len(self.colors)]
                    
                    ax.plot(line_points[:, x_idx], line_points[:, y_idx], 
                           color=color, linewidth=3, alpha=0.9, solid_capstyle='round') 
                    
            ax.set_xlabel(f'{label[0]} (Å)', fontsize=10, color='#34495E')
            ax.set_ylabel(f'{label[1]} (Å)', fontsize=10, color='#34495E')
            ax.set_title(f'Proyección {label}', fontsize=12, color='#2C3E50', pad=15)
            ax.tick_params(colors='#7F8C8D', labelsize=8)
            ax.set_aspect('equal')

            ax.set_facecolor('white')
        plt.tight_layout()

        if save_file:
            plt.savefig(save_file, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
            return
        
        plt.show()
        
    def read_vtk(self):
        try:
            with open(self.vtk_file, 'r') as file:
                lines = file.readlines()
        except FileNotFoundError:
            print(f'File "{self.vtk_file}" not found.')
            return False
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()

            if line.startswith('POINTS'):
                parts = line.split()
                num_points = int(parts[1])
                
                i += 1
                points = []
                points_read = 0
                
                while points_read < num_points and i < len(lines):
                    point_line = lines[i].strip()
                    if point_line and not point_line.startswith('#'):
                        coords = point_line.split()
                        for j in range(0, len(coords), 3):
                            if j + 2 < len(coords) and points_read < num_points:
                                x, y, z = float(coords[j]), float(coords[j+1]), float(coords[j+2])
                                points.append([x, y, z])
                                points_read += 1
                    i += 1
                    
                self.points = np.array(points)
                continue
            elif line.startswith('CELLS'):
                parts = line.split()
                num_cells = int(parts[1])
                
                i += 1
                lines_data = []
                
                for _ in range(num_cells):
                    if i >= len(lines):
                        break
                    cell_line = lines[i].strip()
                    if cell_line and not cell_line.startswith('#'):
                        indices = list(map(int, cell_line.split()))
                        if len(indices) > 1:
                            num_points_in_line = indices[0]
                            point_indices = indices[1:num_points_in_line+1]
                            lines_data.append(point_indices)
                    i += 1
                    
                self.lines = lines_data
                continue
                
            i += 1
            
        return True