from opendxa.core import Sequentials
import opendxa.core.workflow_steps as workflow_steps
import psutil
import logging
import time

logger = logging.getLogger()

def init_worker(templates, template_sizes):
    global TEMPLATES, TEMPLATE_SIZES
    TEMPLATES = templates
    TEMPLATE_SIZES = template_sizes

def analyze_timestep(data, args):
    try:
        process = psutil.Process()
        
        timestep = data['timestep']
        positions = data['positions']
        number_of_atoms = len(positions)
        
        time_start = time.perf_counter()
        memory_start = process.memory_info().rss / 1024 ** 2

        logger.info(
            f'Timestep {timestep}: {number_of_atoms} atoms'
            f'(memory {memory_start:.1f} MiB)'
        )

        context = {
            'data': data,
            'args': args,
            'templates': TEMPLATES,
            'template_sizes': TEMPLATE_SIZES,
            'logger': logger
        }

        workflow = Sequentials(context)

        workflow.register('neighbors', workflow_steps.step_neighbors)
        workflow.register('ptm', workflow_steps.step_classify_ptm, depends_on=['neighbors'])
        workflow.register('filtered', workflow_steps.step_surface_filter, depends_on=['ptm'])
        workflow.register('connectivity', workflow_steps.step_graph, depends_on=['filtered'])
        workflow.register('displacement', workflow_steps.step_displacement, depends_on=['connectivity', 'filtered'])
        workflow.register('loops', workflow_steps.step_burgers_loops, depends_on=['connectivity', 'filtered'])
        workflow.register('lines', workflow_steps.step_dislocation_lines, depends_on=['loops', 'filtered'])
        workflow.register('export', workflow_steps.step_export, depends_on=['lines','loops','filtered'])

        workflow.run()

        total_time = time.perf_counter() - time_start
        memory_end = process.memory_info().rss / 1024 ** 2
        total_memory = memory_end - memory_start

        logger.info(
            f'Timestep {timestep} completed in {total_time:.3f}s '
            f'(Memory {memory_end:.1f} MiB, total: {total_memory:+.1f} MiB)\n'
        )
    except Exception as e:
        logger.error(f'Error in timestep {data["timestep"]}: {e}', exc_info=True)
        workflow.run()

        total_time = time.perf_counter() - time_start
        memory_end = process.memory_info().rss / 1024 ** 2
        total_memory = memory_end - memory_start

        logger.info(
            f'Timestep {timestep} completed in {total_time:.3f}s '
            f'(Memory {memory_end:.1f} MiB, total: {total_memory:+.1f} MiB)\n'
        )
    except Exception as e:
        logger.error(f'Error in timestep {data["timestep"]}: {e}', exc_info=True)