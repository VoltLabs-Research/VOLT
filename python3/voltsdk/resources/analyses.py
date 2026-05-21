"""Analysis resource and collection.

An :class:`Analysis` represents a single analysis run (plugin execution)
on a trajectory.  It exposes exposures, listings, artifact downloads,
and progress information.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BaseResource, BaseCollection

if TYPE_CHECKING:
    from voltsdk.http import HttpTransport
    from .exposures import ExposureCollection
    from .listings import AnalysisListingProxy


class Analysis(BaseResource):
    """A single analysis (plugin run) on a trajectory."""

    @property
    def plugin_name(self) -> str:
        return self._get('pluginDisplayName', '')

    @property
    def plugin_id(self) -> str:
        return self._get('plugin', '')

    @property
    def trajectory_id(self) -> str:
        return self._get('trajectory', '')

    @property
    def config(self) -> dict:
        return self._get('config', {})

    @property
    def status(self) -> str:
        return self._get('status', '')

    @property
    def progress(self) -> float:
        """Fraction of frames completed (0.0 – 1.0)."""
        total = self._get('totalFrames', 0)
        completed = self._get('completedFrames', 0)
        return completed / total if total > 0 else 0.0

    # ------------------------------------------------------------------
    # Sub-resources
    # ------------------------------------------------------------------

    @property
    def exposures(self) -> ExposureCollection:
        """Lazy collection of exposure results for this analysis."""
        from .exposures import ExposureCollection as _EC

        team_id = self._client.team_id
        return _EC(
            self._client,
            path=f'/plugins/{team_id}/listings/analyses/{self.id}',
            analysis_id=self.id,
        )

    @property
    def listings(self) -> AnalysisListingProxy:
        """Access listing rows for this analysis across all exposures."""
        from .listings import AnalysisListingProxy as _ALP

        return _ALP(self._client, self)

    # ------------------------------------------------------------------
    # Artifact downloads
    # ------------------------------------------------------------------

    def download_artifacts(self, dest: str = '.', unzip: bool = True) -> str:
        """Download all analysis artifacts (msgpack + GLB files).

        Parameters
        ----------
        dest:
            Destination directory.
        unzip:
            If ``True`` (default), recursively extract zip files.

        Returns
        -------
        str
            Path to the extracted directory (or zip file if *unzip* is
            ``False``).
        """
        team_id = self._client.team_id
        path = f'/plugins/{team_id}/exposures/analyses/{self.id}/export'
        zip_path = self._client.download_stream(
            path,
            fallback_name=f'analysis-{self.id}-artifacts.zip',
            dest=dest,
        )
        if unzip:
            return self._client.unzip_recursive(zip_path)
        return zip_path

    def open_in_volt(
        self,
        *,
        timestep: int | None = None,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from voltsdk.viewer import open_canvas_view

        return open_canvas_view(
            trajectory_id=self.trajectory_id,
            analysis_id=self.id,
            timestep=timestep,
            volt_url=volt_url,
            open_browser=open_browser,
        )


class AnalysisCollection(BaseCollection['Analysis']):
    """Paginated collection of analyses.

    Typically accessed via ``trajectory.analyses`` or
    ``client.analyses``.
    """

    def __init__(
        self,
        client: HttpTransport,
        path: str = '',
        params: dict | None = None,
        page_size: int = 100,
    ) -> None:
        super().__init__(
            client,
            path=path,
            resource_cls=Analysis,
            params=params,
            page_size=page_size,
        )
