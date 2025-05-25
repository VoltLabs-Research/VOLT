from opendxa.core.sequentials import Sequentials
from .neighbors import step_neighbors, step_classify_ptm
from .filtering import step_surface_filter, step_delaunay_tessellation
from .connectivity import step_graph
from .displacement import step_displacement
from .burgers import step_burgers_loops, step_advanced_grouping
from .refinement import step_refine_lines
from .validation import step_unified_validation, step_summary_report
from .lines import step_dislocation_lines
from .export import step_export, step_export_fast

def create_and_configure_workflow(ctx):
    workflow = Sequentials(ctx)
    args = ctx.get('args')
    
    # Check if we should use fast mode
    fast_mode = getattr(args, 'fast_mode', False)
    
    # Core pipeline (always required)
    workflow.register('neighbors', step_neighbors)
    workflow.register('ptm', step_classify_ptm, depends_on=['neighbors'])
    workflow.register('filtered', step_surface_filter, depends_on=['ptm'])
    workflow.register('tessellation', step_delaunay_tessellation, depends_on=['filtered'])
    workflow.register('connectivity', step_graph, depends_on=['filtered', 'tessellation'])
    
    if fast_mode:
        # Fast mode: Skip displacement analysis and some refinement steps
        workflow.register('loops', step_burgers_loops, depends_on=['connectivity', 'filtered'])
        workflow.register('advanced_loops', step_advanced_grouping, depends_on=['loops', 'filtered'])
        workflow.register('export', step_export_fast, depends_on=['advanced_loops'])
    else:
        # Full pipeline
        workflow.register('displacement', step_displacement, depends_on=['connectivity', 'filtered'])
        
        workflow.register('loops', step_burgers_loops, depends_on=['connectivity', 'filtered'])
        workflow.register('advanced_loops', step_advanced_grouping, depends_on=['loops', 'filtered'])
        
        # Unified validation replaces separate validation and elastic mapping
        workflow.register('validate', step_unified_validation, depends_on=['advanced_loops', 'displacement', 'filtered'])
        workflow.register('summary', step_summary_report, depends_on=['validate'])
        workflow.register('lines', step_dislocation_lines, depends_on=['advanced_loops', 'filtered'])
        
        workflow.register('refinement', step_refine_lines, depends_on=['lines', 'filtered'])
        workflow.register('export', step_export, depends_on=['refinement'])

    return workflow