from typing import Any, Dict
from opendxa.core.sequentials import Sequentials
from opendxa.workflow.register_blocks import (
    register_core_steps,
    register_classification_steps,
    register_filter_and_tessellation,
    register_fast_pipeline,
    register_full_pipeline
)

def create_and_configure_workflow(ctx: Dict[str, Any]) -> Sequentials:
    workflow = Sequentials(ctx)
    args = ctx.get('args', {})

    register_core_steps(workflow)
    register_classification_steps(workflow, use_cna=args.use_cna)
    register_filter_and_tessellation(workflow)

    if args.fast_mode:
        register_fast_pipeline(workflow)
    else:
        register_full_pipeline(workflow)

    return workflow
