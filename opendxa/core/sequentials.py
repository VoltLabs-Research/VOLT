import logging
import time

logger = logging.getLogger()

class Sequentials:
    def __init__(self, context=None):
        self.steps = []
        self.context = context or {}
        self.outputs = {}
        self.timing_stats = {}

    def register(self, name, func, depends_on=None):
        self.steps.append({
            'name': name,
            'func': func,
            'depends_on': depends_on or []
        })

    def run(self):
        total_start = time.perf_counter()
        
        for step in self.steps:
            name = step['name']
            func = step['func']
            deps = step['depends_on']
            inputs = {k: self.outputs[k] for k in deps}
            
            # Start timing this step
            step_start = time.perf_counter()
            logger.debug(f'Running step: {name} (depends on: {deps})')
            
            result = func(self.context, **inputs)
            
            # Record timing
            step_time = time.perf_counter() - step_start
            self.timing_stats[name] = step_time
            
            logger.info(f'Step {name} completed in {step_time:.3f}s')
            self.outputs[name] = result
        
        total_time = time.perf_counter() - total_start
        logger.info(f'Total workflow time: {total_time:.3f}s')
        
        # Log timing breakdown for slowest steps
        sorted_times = sorted(self.timing_stats.items(), key=lambda x: x[1], reverse=True)
        logger.info('Timing breakdown (slowest first):')
        for step_name, step_time in sorted_times[:5]:  # Top 5 slowest
            percentage = (step_time / total_time) * 100
            logger.info(f'  {step_name}: {step_time:.3f}s ({percentage:.1f}%)')

    def get_output(self, name):
        return self.outputs.get(name)