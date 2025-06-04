from opendxa.parser import LammpstrjParser
from opendxa.export import DislocationDataset
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
    '''
    Encapsulates the full dislocation analysis workflow. Can be run either
    in tracking mode or by iterating over
    timesteps of a LAMMPS trajectory in parallel.
    '''
    def __init__(self, config: AnalysisConfig) -> None:
        '''
        Initialize the DislocationAnalysis with a given configuration.

        Args:
            config (AnalysisConfig): Configuration object containing all parameters
                                     for the analysis (e.g., file paths, thresholds,
                                     parallelism settings, etc.).

        Side Effects:
            - Configures logging based on config.verbose.
            - Loads PTM/CNA templates and stores them into config._ptm_templates
              and config._ptm_template_sizes for later use by worker processes.
            - Initializes a LammpstrjParser for iterating timesteps.
        '''
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
        '''
        Yield only those timestep dictionaries whose 'timestep' field matches
        specific_timestep, or yield all if specific_timestep is None.

        Args:
            iterable (Iterable[Dict[str, Any]]): An iterable producing timestep
                                                  data dictionaries (as from LammpstrjParser.iter_timesteps()).
            specific_timestep (Optional[int]): If provided, only timesteps equal
                                               to this value are yielded. If None,
                                               all timesteps are yielded.

        Yields:
            Dict[str, Any]: A dictionary containing keys 'timestep', 'box', 'ids',
                            and 'positions' for each matching timestep.
        '''
        for data in iterable:
            if specific_timestep is not None and data['timestep'] != specific_timestep:
                continue
            yield data
        
    def run(self) -> None:
        '''
        Execute the dislocation analysis.

        If config.track_dir is set, run DislocationTracker on that directory
        and exit. Otherwise, parse the LAMMPS trajectory file, optionally
        filter by a specific timestep, and launch parallel worker processes
        to call analyze_timestep on each frame.

        Args:
            None

        Returns:
            None

        Raises:
            Any exception raised by DislocationTracker methods or analyze_timestep
            will propagate out of this method.
        '''
        # Tracking mode
        if self.config.track_dir:
            logger.info(f'Tracking dislocations from "{self.config.track_dir}"')
            dataset = DislocationDataset(self.config.track_dir)

            dataset.load_all_timesteps()

            '''
            if self.config.run_burgers_histogram:
                tracker.compute_statistics()
                tracker.plot_burgers_histogram()

            if self.config.spacetime_heatmap:
                tracker.plot_spacetime_heatmap()

            if self.config.run_voxel_density:
                counts = tracker.voxel_density(
                    grid_size=self.config.voxel_grid_size,
                    box_bounds=self.config.voxel_box_bounds
                )
                logger.info(f'Voxel density counts (non-zero): { {k: v for k, v in counts.items() if v>0} }')

            if self.config.run_clustering:
                kmeans_obj, centroids_all, labels = tracker.cluster_centroids(
                    n_clusters=self.config.clustering_n_clusters
                )
                logger.info(f'KMeans inertia: {kmeans_obj.inertia_}')

            if self.config.run_tortuosity:
                tracker.plot_tortuosity_histogram()

            if self.config.run_orientation:
                tracker.compute_orientation_histogram(bins=self.config.orientation_bins)

            if self.config.run_graph_topology:
                ts_list = self.config.graph_topology_timesteps or list(tracker.timesteps_data.keys())
                for t in ts_list:
                    stats = tracker.analyze_graph_topology(t)
                    logger.info(f'Graph topology @ timestep {t}: {stats}')

            return
            '''
        
        # Normal mode: parse and analyze trajectory
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