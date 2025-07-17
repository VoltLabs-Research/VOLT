from opendxa.visualizers import DislocationVisualizer
from pathlib import Path
import sys
import json

if len(sys.argv) != 2:
    print("Usage: python simple_visualize.py <json_file>")
    sys.exit(1)
    
    json_file = sys.argv[1]
    if not Path(json_file).exists():
        print(f"Error: File '{json_file}' does not exist")
        sys.exit(1)
    
    
    print(f"Loading {json_file}...")
    with open(json_file, 'r') as f:
        data = json.load(f)

    print("Creating visualization...")
    visualizer = DislocationVisualizer(data)
    plotter, stats = visualizer.visualize()