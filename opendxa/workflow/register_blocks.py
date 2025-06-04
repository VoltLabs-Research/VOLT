from opendxa.core.sequentials import Sequentials, StepConfig
from .steps.neighbors import step_neighbors, step_classify_ptm, step_classify_cna
from .steps.filtering import step_surface_filter, step_delaunay_tessellation
from .steps.connectivity import step_graph
from .steps.displacement import step_displacement
from .steps.burgers import step_burgers_loops, step_advanced_grouping
from .steps.refinement import step_refine_lines
from .steps.validation import step_unified_validation, step_summary_report
from .steps.lines import step_dislocation_lines
from .steps.export import step_export, step_export_fast
from .steps.clustering import step_build_clusters
from .steps.elastic_mapping import step_elastic_mapping, step_interface_mesh
from .steps.core_marking import step_mark_core_atoms
from .steps.advanced_statistics import step_stats_report

def register_core_steps(workflow: Sequentials) -> None:
    workflow.register(
        StepConfig(
            name='neighbors',
            func=step_neighbors,
            depends_on=[]
        )
    )

def register_classification_steps(workflow: Sequentials, use_cna: bool) -> None:
    if use_cna:
        func = step_classify_cna
    else:
        func = step_classify_ptm
    
    workflow.register(
        StepConfig(
            name='structure_classification',
            func=func,
            depends_on=['neighbors']
        )
    )

def register_filter_and_tessellation(workflow: Sequentials) -> None:
    workflow.register(
        StepConfig(
            name='filtered',
            func=step_surface_filter,
            depends_on=['structure_classification']
        )
    )

    workflow.register(
        StepConfig(
            name='tessellation',
            func=step_delaunay_tessellation,
            depends_on=['filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='connectivity',
            func=step_graph,
            depends_on=['filtered', 'tessellation']
        )
    )

def register_fast_pipeline(workflow: Sequentials) -> None:
    workflow.register(
        StepConfig(
            name='loops',
            func=step_burgers_loops,
            depends_on=['connectivity', 'filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='advanced_loops',
            func=step_advanced_grouping,
            depends_on=['loops', 'filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='export',
            func=step_export_fast,
            depends_on=['advanced_loops', 'filtered']
        )
    )

def register_full_pipeline(workflow: Sequentials) -> None:
    workflow.register(
        StepConfig(
            name='cluster',
            func=step_build_clusters,
            depends_on=['filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='elastic_map',
            func=step_elastic_mapping,
            depends_on=['cluster', 'tessellation', 'filtered', 'structure_classification']
        )
    )

    workflow.register(
        StepConfig(
            name='interface_mesh',
            func=step_interface_mesh,
            depends_on=['elastic_map', 'filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='displacement',
            func=step_displacement,
            depends_on=['filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='loops',
            func=step_burgers_loops,
            depends_on=['filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='advanced_loops',
            func=step_advanced_grouping,
            depends_on=['loops', 'filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='validate',
            func=step_unified_validation,
            depends_on=[
                'advanced_loops',
                'displacement',
                'filtered',
                'structure_classification',
                'elastic_map',
                'interface_mesh'
            ]
        )
    )

    workflow.register(
        StepConfig(
            name='summary',
            func=step_summary_report,
            depends_on=['validate']
        )
    )

    workflow.register(
        StepConfig(
            name='lines',
            func=step_dislocation_lines,
            depends_on=['advanced_loops', 'filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='refinement',
            func=step_refine_lines,
            depends_on=['lines', 'filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='core_marking',
            func=step_mark_core_atoms,
            depends_on=['refinement', 'interface_mesh', 'filtered']
        )
    )

    workflow.register(
        StepConfig(
            name='advanced_stats',
            func=step_stats_report,
            depends_on=['validate', 'core_marking']
        )
    )

    workflow.register(
        StepConfig(
            name='export',
            func=step_export,
            depends_on=['refinement', 'filtered', 'structure_classification']
        )
    )