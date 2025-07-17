export interface AnalysisConfig {
    crystal_structure: 'FCC' | 'BCC' | 'HCP';
    identification_mode: 'PTM' | 'CNA';
    max_trial_circuit_size: number;
    circuit_stretchability: number;
    defect_mesh_smoothing_level: number;
    line_smoothing_level: number;
    line_point_interval: number;
    only_perfect_dislocations: boolean;
    mark_core_atoms: boolean;
}