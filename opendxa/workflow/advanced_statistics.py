from opendxa.classification.dislocation_statistics import DislocationStatisticsGenerator
from typing import Dict, List, Tuple
from collections import defaultdict
import numpy as np
import pandas as pd
import logging

logger = logging.getLogger(__name__)

def step_stats_report(ctx, validate, core_marking):
    """
    Generate advanced statistical reports similar to OVITO's DataTable functionality.
    Creates detailed tables with dislocation statistics, lengths, densities, and more.
    """
    data = ctx['data']
    positions = data['positions']
    box_bounds = data['box']
    
    # Get validation results
    validated_loops = validate.get('validated_loops', [])
    burgers_vectors = validate.get('burgers_vectors', {})
    
    # Get core marking results
    dislocation_ids = core_marking.get('dislocation_ids', {})
    
    # Get dislocation lines from context
    lines_result = ctx.get('lines_result', {})
    dislocation_lines = lines_result.get('lines', [])
    
    logger.info("Generating advanced statistical reports...")
    
    # Create statistics reporter
    stats_reporter = DislocationStatisticsGenerator(
        positions=positions,
        box_bounds=box_bounds,
        validated_loops=validated_loops,
        burgers_vectors=burgers_vectors,
        dislocation_ids=dislocation_ids,
        dislocation_lines=dislocation_lines
    )
    
    # Generate comprehensive reports
    reports = stats_reporter.generate_reports()
    
    logger.info(f"Generated {len(reports)} statistical reports")
    
    return reports