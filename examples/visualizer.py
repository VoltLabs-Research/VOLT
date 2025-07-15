#!/usr/bin/env python3
"""
Simple example to quickly visualize OpenDXA JSON results.

Usage:
    python simple_visualize.py path/to/dislocation_results.json
"""

import sys
import json
from pathlib import Path

def main():
    if len(sys.argv) != 2:
        print("Usage: python simple_visualize.py <json_file>")
        sys.exit(1)
    
    json_file = sys.argv[1]
    if not Path(json_file).exists():
        print(f"Error: File '{json_file}' does not exist")
        sys.exit(1)
    
    # Import OpenDXA
    try:
        import opendxa
        from opendxa.visualizers import DislocationVisualizer, VisualizationSettings
    except ImportError as e:
        print(f"Error importing OpenDXA: {e}")
        print("Make sure OpenDXA Python bindings are installed.")
        sys.exit(1)
    
    # Load JSON data
    print(f"Loading {json_file}...")
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Create visualizer and show
    print("Creating visualization...")
    x = VisualizationSettings()
    x.show_interface=True
    visualizer = DislocationVisualizer(data, x)
    plotter, stats = visualizer.visualize()
    
    # Print basic stats
    if stats:
        print(f"\nQuick Stats:")
        print(f"  Segments: {stats.num_segments}")
        print(f"  Total length: {stats.total_length:.2f} Å")
        print(f"  Avg length: {stats.average_length:.2f} Å")

if __name__ == "__main__":
    main()