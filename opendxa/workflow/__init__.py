from opendxa.core.sequentials import Sequentials
from .neighbors import step_neighbors, step_classify_ptm, step_classify_cna
from .filtering import step_surface_filter, step_delaunay_tessellation
from .connectivity import step_graph
from .displacement import step_displacement
from .burgers import step_burgers_loops, step_advanced_grouping
from .refinement import step_refine_lines
from .validation import step_unified_validation, step_summary_report
from .lines import step_dislocation_lines
from .export import step_export, step_export_fast
# New enhanced workflow steps
from .clustering import step_build_clusters
from .elastic_mapping import step_elastic_mapping, step_interface_mesh
from .core_marking import step_mark_core_atoms
from .advanced_statistics import step_stats_report

def create_and_configure_workflow(ctx):
    workflow = Sequentials(ctx)
    args = ctx.get('args')
    
    # Core pipeline (always required)
    workflow.register('neighbors', step_neighbors)
    
    # Choose classification method based on use_cna argument
    if args.use_cna:
        workflow.register('structure_classification', step_classify_cna, depends_on=['neighbors'])
    else:
        workflow.register('structure_classification', step_classify_ptm, depends_on=['neighbors'])
    
    workflow.register('filtered', step_surface_filter, depends_on=['structure_classification'])
    workflow.register('tessellation', step_delaunay_tessellation, depends_on=['filtered'])
    workflow.register('connectivity', step_graph, depends_on=['filtered', 'tessellation'])
    
    if args.fast_mode:
        # Fast mode: Skip displacement analysis and some refinement steps
        workflow.register('loops', step_burgers_loops, depends_on=['connectivity', 'filtered'])
        workflow.register('advanced_loops', step_advanced_grouping, depends_on=['loops', 'filtered'])
        workflow.register('export', step_export_fast, depends_on=['advanced_loops', 'filtered'])
    else:
        # Full pipeline with enhanced crystallographic analysis
        # Add new clustering and elastic mapping steps
        workflow.register('cluster', step_build_clusters, depends_on=['filtered'])
        workflow.register('elastic_map', step_elastic_mapping, depends_on=['cluster', 'tessellation', 'filtered', 'structure_classification'])
        workflow.register('interface_mesh', step_interface_mesh, depends_on=['elastic_map', 'filtered'])
        
        # Original displacement and connectivity steps
        workflow.register('displacement', step_displacement, depends_on=['filtered'])
        
        workflow.register('loops', step_burgers_loops, depends_on=['filtered'])
        workflow.register('advanced_loops', step_advanced_grouping, depends_on=['loops', 'filtered'])
        
        # Enhanced unified validation that takes into account elastic mapping
        workflow.register('validate', step_unified_validation, depends_on=['advanced_loops', 'displacement', 'filtered', 'structure_classification', 'elastic_map', 'interface_mesh'])
        workflow.register('summary', step_summary_report, depends_on=['validate'])
        workflow.register('lines', step_dislocation_lines, depends_on=['advanced_loops', 'filtered'])
        
        workflow.register('refinement', step_refine_lines, depends_on=['lines', 'filtered'])
        
        # New enhanced steps for core marking and advanced statistics
        workflow.register('core_marking', step_mark_core_atoms, depends_on=['refinement', 'interface_mesh', 'filtered'])
        workflow.register('advanced_stats', step_stats_report, depends_on=['validate', 'core_marking'])
        
        workflow.register('export', step_export, depends_on=['refinement', 'filtered', 'structure_classification'])

    return workflow