from pathlib import Path

import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
import argparse
import json

def load_stats(path):
    with open(path, 'r') as file:
        return json.load(file)

def create_density_df(stats):
    rows = []
    for data in stats:
        name = data.get('name')
        for dislocation in data.get('dislocationsDensity', []):
            rows.append({
                'name': name,
                'timestep': dislocation.get('timestep'),
                'density': dislocation.get('density')
            })

    return pd.DataFrame(rows)

def create_structure_analysis_df(stats):
    rows = []
    for data in stats:
        name = data.get('name')
        for analysis in data.get('structureAnalysis', []):
            rows.append({
                'name': name,
                'timestep': analysis.get('timestep'),
                'identificationRate': analysis.get('identificationRate'),
                'totalAtoms': analysis.get('totalAtoms'),
                'analysisMethod': analysis.get('analysisMethod')
            })

    return pd.DataFrame(rows)

def create_dislocations_summary_df(stats):
    rows = []
    for data in stats:
        name = data.get('name')
        for dislocation in data.get('dislocations', []):
            rows.append({
                'name': name,
                'timestep': dislocation.get('timestep'),
                'totalSegments': dislocation.get('totalSegments'),
                'totalLength': dislocation.get('totalLength'),
                'averageSegmentLength': dislocation.get('averageSegmentLength')
            })

    return pd.DataFrame(rows)

def plot_line(df, x, y, hue, title, outfile):
    if df.empty: 
        return
    
    plt.figure()
    sns.lineplot(data=df.sort_values(x), x=x, y=y, hue=hue, marker='o')
    plt.title(title)
    plt.tight_layout()
    plt.savefig(outfile, dpi=200)
    plt.close()

def plot_dist(df, x, hue, title, outfile):
    if df.empty:
        return
    
    plt.figure()
    sns.kdeplot(data=df, x=x, hue=hue, common_norm=False, fill=True, alpha=0.3)
    plt.title(title)
    plt.tight_layout()
    plt.savefig(outfile, dpi=200)
    plt.close()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input', help='Path to analysis-stats.json')
    ap.add_argument('-o', '--outdir', default='analysis_plots', help='Output directory')
    ap.add_argument('--sample-segments', type=int, default=200000)
    args = ap.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    stats = load_stats(args.input)

    df_density = create_density_df(stats)
    df_structures = create_structure_analysis_df(stats)
    df_dislocations = create_dislocations_summary_df(stats)

    plot_line(df_density, 'timestep', 'density', 'name', 'Dislocation Density vs Timestep', outdir / 'density_vs_timestep.png')

    last_ts = df_density['timestep'].max()
    snap = df_density[df_density['timestep'] == last_ts]
    plot_dist(snap, 'density', 'name', f'Dislocation Density Distribution at timestep {int(last_ts)}', outdir / 'density_distribution_last_timestep.png')

    plot_line(df_structures, 'timestep', 'identificationRate', 'name', 'Identification Rate vs Timestep', outdir / 'identification_rate_vs_timestep.png')
    plot_line(df_structures, 'timestep', 'totalAtoms', 'name', 'Total Atoms vs Timestep', outdir / 'total_atoms_vs_timestep.png')


    plot_line(df_dislocations, 'timestep', 'averageSegmentLength', 'name', 'Average Segment Length vs Timestep', outdir / 'avg_segment_length_vs_timestep.png')
    plot_line(df_dislocations, 'timestep', 'totalSegments', 'name', 'Total Segments vs Timestep', outdir / 'total_segments_vs_timestep.png')
    plot_line(df_dislocations, 'timestep', 'totalLength', 'name', 'Total Dislocation Length vs Timestep', outdir / 'total_dislocation_length_vs_timestep.png')
