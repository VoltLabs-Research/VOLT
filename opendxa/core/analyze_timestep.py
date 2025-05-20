from opendxa.core.workflow_steps import create_and_configure_workflow
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

        ctx = {
            'data': data,
            'args': args,
            'templates': TEMPLATES,
            'template_sizes': TEMPLATE_SIZES,
            'logger': logger
        }

        workflow = create_and_configure_workflow(ctx=ctx)
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