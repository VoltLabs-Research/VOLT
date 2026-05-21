"""Exposure resource and collection.

An :class:`Exposure` represents one result "slot" produced by an
analysis plugin (e.g. *Dislocations*, *Common Neighbor Analysis*).
Each exposure has its own listing rows and optional GLB 3D models.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BaseResource, BaseCollection

if TYPE_CHECKING:
    import pandas as pd
    from voltsdk.http import HttpTransport


class Exposure(BaseResource):
    """A single exposure (result slot) within an analysis."""

    def __init__(
        self,
        client: HttpTransport,
        data: dict,
        *,
        analysis_id: str = '',
    ) -> None:
        super().__init__(client, data)
        self._analysis_id = analysis_id

    @property
    def name(self) -> str:
        return self._get('name', '')

    @property
    def exposure_type(self) -> str:
        return self._get('type', '')

    @property
    def analysis_id(self) -> str:
        return self._analysis_id or self._get('analysis', '')

    # ------------------------------------------------------------------
    # Listings for this exposure
    # ------------------------------------------------------------------

    @property
    def listings(self):
        """Listing rows scoped to this exposure."""
        from .listings import ListingCollection

        team_id = self._client.team_id
        return ListingCollection(
            self._client,
            path=f'/plugins/{team_id}/listings/analyses/{self.analysis_id}',
            params={'exposureId': self.id},
        )

    def sub_listings(
        self,
        sub_listing_name: str,
        timestep: int,
    ) -> pd.DataFrame:
        """Fetch a sub-listing table for a specific timestep.

        Parameters
        ----------
        sub_listing_name:
            Name of the sub-listing (e.g. ``"dislocation_segments"``).
        timestep:
            The simulation timestep.

        Returns
        -------
        pd.DataFrame
        """
        import pandas as _pd

        team_id = self._client.team_id
        data = self._client.get(
            f'/plugins/{team_id}/listings/analyses/{self.analysis_id}'
            f'/sub-listings/{self.id}/{timestep}/{sub_listing_name}',
        )
        rows = data.get('data', data) if isinstance(data, dict) else data
        if isinstance(rows, list):
            return _pd.DataFrame(rows)
        return _pd.DataFrame()

    # ------------------------------------------------------------------
    # GLB download
    # ------------------------------------------------------------------

    def download_glb(self, timestep: int, dest: str = '.') -> str:
        """Download the GLB 3D model for this exposure at a given timestep."""
        team_id = self._client.team_id
        traj_id = self._get('trajectory', '')
        return self._client.download_stream(
            f'/plugins/{team_id}/exposures/glb/{traj_id}/{self.analysis_id}/{self.id}/{timestep}',
            fallback_name=f'exposure-{self.id}-{timestep}.glb',
            dest=dest,
        )

    def open_in_volt(
        self,
        timestep: int,
        *,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from voltsdk.viewer import open_canvas_view

        trajectory_id = self._get('trajectory', '')
        if not trajectory_id:
            raise ValueError('Exposure does not include a trajectory ID.')

        return open_canvas_view(
            trajectory_id=trajectory_id,
            analysis_id=self.analysis_id,
            exposure_id=self.id,
            timestep=timestep,
            volt_url=volt_url,
            open_browser=open_browser,
        )


class ExposureCollection(BaseCollection['Exposure']):
    """Paginated collection of exposures for an analysis."""

    def __init__(
        self,
        client: HttpTransport,
        path: str,
        analysis_id: str = '',
        params: dict | None = None,
        page_size: int = 100,
    ) -> None:
        super().__init__(
            client, path, resource_cls=None, params=params, page_size=page_size,
        )
        self._analysis_id = analysis_id

    def _wrap(self, data: dict) -> Exposure:
        return Exposure(self._client, data, analysis_id=self._analysis_id)
