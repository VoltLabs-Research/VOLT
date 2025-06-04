from opendxa.parser import LammpstrjParser
from opendxa.export import DislocationTracker
from opendxa.core.analysis_config import AnalysisConfig
from opendxa.utils.ptm_templates import get_ptm_templates
from opendxa.utils.logging import setup_logging
from opendxa.core import analyze_timestep, init_worker
from concurrent.futures import ProcessPoolExecutor
from functools import partial
from typing import Optional, Iterable, Dict, Any

import logging

logger = logging.getLogger(__name__)

class DislocationAnalysis:
    def __init__(self, config: AnalysisConfig) -> None:
        self.config = config
        setup_logging(self.config.verbose)
        templates, template_sizes = get_ptm_templates()
        self.config._ptm_templates = templates
        self.config._ptm_template_sizes = template_sizes
        self.parser = LammpstrjParser(self.config.lammpstrj)

    def _filter_timesteps(
        self,
        iterable: Iterable[Dict[str, Any]],
        specific_timestep: Optional[int]
    ) -> Iterable[Dict[str, Any]]:
        for data in iterable:
            if specific_timestep is not None and data['timestep'] != specific_timestep:
                continue
            yield data
        
    def run(self) -> None:
        if self.config.track_dir:
            logger.info(f'Tracking dislocations from "{self.config.track_dir}"')
            tracker = DislocationTracker(self.config.track_dir)
            tracker.load_all_timesteps()
            tracker.compute_statistics()
            tracker.plot_burgers_histogram()
            tracker.track_dislocations()
            return

        logger.info(f'Using "{self.config.lammpstrj}" for analysis')
        all_timesteps = self.parser.iter_timesteps()
        filtered = self._filter_timesteps(all_timesteps, self.config.timestep)
        worker_func = partial(analyze_timestep, args=self.config)

        with ProcessPoolExecutor(
            max_workers=self.config.workers,
            initializer=init_worker,
            initargs=(self.config._ptm_templates, self.config._ptm_template_sizes)
        ) as executor:
            executor.map(worker_func, filtered)