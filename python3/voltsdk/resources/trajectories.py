"""Trajectory resource and collection.

A :class:`Trajectory` is the primary entry-point for scientific data
exploration.  It provides access to frames, analyses, simulation cells,
listings, plotting, and OVITO integration.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BaseResource, BaseCollection

if TYPE_CHECKING:
    from voltsdk.http import HttpTransport
    from .analyses import AnalysisCollection
    from .frames import FrameCollection
    from .listings import TrajectoryListingProxy
    from .simulation_cells import SimulationCell


class Trajectory(BaseResource):
    """A molecular-dynamics trajectory stored in Volt."""

    @property
    def name(self) -> str:
        return self._get('name', '')

    @property
    def status(self) -> str:
        return self._get('status', '')

    @property
    def is_public(self) -> bool:
        return self._get('isPublic', False)

    @property
    def frame_count(self) -> int:
        return len(self._get('frames', []))

    # ------------------------------------------------------------------
    # Sub-resources
    # ------------------------------------------------------------------

    @property
    def frames(self) -> FrameCollection:
        """Access trajectory frames (no extra API call needed).

        Frames are sourced from the trajectory metadata array.
        """
        from .frames import FrameCollection as _FC

        raw_frames = self._get('frames', [])
        return _FC.from_trajectory_data(self._client, self.id, raw_frames)

    @property
    def analyses(self) -> AnalysisCollection:
        """Lazy collection of analyses for this trajectory."""
        from .analyses import AnalysisCollection as _AC

        team_id = self._client.team_id
        return _AC(
            self._client,
            path=f'/analyses/{team_id}/trajectory/{self.id}',
        )

    @property
    def simulation_cell(self) -> SimulationCell | None:
        """Simulation cell / box geometry (fetched on access)."""
        from .simulation_cells import SimulationCell as _SC

        team_id = self._client.team_id
        data = self._client.get(
            f'/simulation-cells/{team_id}/trajectories/{self.id}',
        )
        return _SC(self._client, data) if data else None

    @property
    def listings(self) -> TrajectoryListingProxy:
        """Aggregate listings across all analyses for this trajectory."""
        from .listings import TrajectoryListingProxy as _TLP

        return _TLP(self._client, self)

    # ------------------------------------------------------------------
    # Downloads
    # ------------------------------------------------------------------

    def download(self, dest: str = '.') -> str:
        """Download the original trajectory file(s)."""
        team_id = self._client.team_id
        return self._client.download_stream(
            f'/trajectories/{team_id}/{self.id}/download',
            fallback_name=f'trajectory-{self.id}.zip',
            dest=dest,
        )

    def open_in_volt(
        self,
        *,
        analysis_id: str | None = None,
        timestep: int | None = None,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from voltsdk.viewer import open_canvas_view

        return open_canvas_view(
            trajectory_id=self.id,
            analysis_id=analysis_id,
            timestep=timestep,
            volt_url=volt_url,
            open_browser=open_browser,
        )

    # ------------------------------------------------------------------
    # Plotting
    # ------------------------------------------------------------------

    def plot(self, columns, **kwargs):
        """Quick plot of listing data across analyses.

        Parameters
        ----------
        columns:
            Column name(s) to plot against timestep.
        **kwargs:
            Passed to matplotlib.
        """
        from voltsdk.integrations.plotting import plot_trajectory_listings
        return plot_trajectory_listings(self, columns, **kwargs)

    # ------------------------------------------------------------------
    # OVITO integration
    # ------------------------------------------------------------------

    def to_ovito_pipeline(self, timesteps=None):
        """Create an OVITO Pipeline from this trajectory's dump files.

        Parameters
        ----------
        timesteps:
            Specific timesteps to include.  Default: all frames.

        Returns
        -------
        ovito.Pipeline
        """
        from voltsdk.integrations.ovito import create_pipeline
        return create_pipeline(self, timesteps=timesteps)

    def __repr__(self) -> str:
        return f'<Trajectory name={self.name!r} id={self.id}>'


class TrajectoryCollection(BaseCollection['Trajectory']):
    """Paginated collection of trajectories.

    Supports optional search filtering::

        client.trajectories.list(search="copper")
    """

    def __init__(
        self,
        client: HttpTransport,
        params: dict | None = None,
        page_size: int = 100,
    ) -> None:
        team_id = client.team_id
        super().__init__(
            client,
            path=f'/trajectories/{team_id}/',
            resource_cls=Trajectory,
            params=params,
            page_size=page_size,
        )

    def get(self, trajectory_id: str) -> Trajectory:
        """Fetch a single trajectory by ID.

        Parameters
        ----------
        trajectory_id:
            The trajectory's MongoDB ``_id``.

        Returns
        -------
        Trajectory
        """
        team_id = self._client.team_id
        data = self._client.get(f'/trajectories/{team_id}/{trajectory_id}')
        return Trajectory(self._client, data)

    def list(self, search: str | None = None, **kwargs) -> list[Trajectory]:
        """Eagerly fetch all trajectories, optionally filtering by name.

        Parameters
        ----------
        search:
            Case-insensitive name filter applied server-side.
        """
        if search:
            self._params['search'] = search
        return super().list(**kwargs)
