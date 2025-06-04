from dataclasses import dataclass, field
from typing import Callable, List
import logging
import time

logger = logging.getLogger()

@dataclass
class StepConfig:
    name: str
    func: Callable[..., any]
    depends_on: List[str] = field(default_factory=list)

class Sequentials:
    def __init__(self, context=None):
        self.steps = []
        self.context = context or {}
        self.outputs = {}
        self.timing_stats = {}

    def register(self, step):
        if any(s.name == step.name for s in self.steps):
            raise ValueError(f"Step '{step.name}' already registered.")
        self.steps.append(step)

    def run(self):
        total_start = time.perf_counter()

        for step in self.steps:
            name = step.name
            func = step.func
            deps = step.depends_on

            for dep in deps:
                if dep not in self.outputs:
                    raise RuntimeError(
                        f"Step '{name}' needs '{dep}',"
                        f"but '{dep}' has not been executed."
                    )

            inputs = {dep: self.outputs[dep] for dep in deps}

            step_start = time.perf_counter()
            logger.debug(f"Running step '{name}' (depends on: {deps})")
            
            resultado = func(self.context, **inputs)
            
            step_time = time.perf_counter() - step_start
            self.timing_stats[name] = step_time
            self.outputs[name] = resultado

            logger.info(f"Step '{name}' completed in {step_time:.3f} s")

        total_time = time.perf_counter() - total_start
        logger.info(f"Tiempo total del workflow: {total_time:.3f} s")

        ordenados = sorted(
            self.timing_stats.items(), key=lambda x: x[1], reverse=True
        )
        logger.info('Time Breakdown (5 Slowest):')
        for paso, t in ordenados[:5]:
            porcentaje = (t / total_time) * 100
            logger.info(f"  {paso}: {t:.3f} s ({porcentaje:.1f}%)")

    def get_output(self, name: str):
        return self.outputs.get(name)