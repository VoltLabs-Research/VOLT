from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BaseResource, BaseCollection

if TYPE_CHECKING:
    from voltsdk.http import HttpTransport
    from .exposures import ExposureCollection
    from .listings import ListingCollection

class Analysis(BaseResource):

    @property
    def exposures(self) -> ExposureCollection:
        from .exposures import ExposureCollection as _EC

        team_id = self._client.team_id
        return _EC(
            self._client,
            path=f'/plugins/{team_id}/listings/analyses/{self.id}',
            analysis_id=self.id,
        )

    @property
    def listings(self) -> ListingCollection:
        from .listings import ListingCollection

        team_id = self._client.team_id
        return ListingCollection(self._client, path=f'/plugins/{team_id}/listings/analyses/{self.id}')

    def download_artifacts(self, dest: str = '.', unzip: bool = True) -> str:
        team_id = self._client.team_id
        zip_path = self._client.download_stream(
            f'/plugins/{team_id}/exposures/analyses/{self.id}/export',
            fallback_name=f'analysis-{self.id}-artifacts.zip',
            dest=dest,
        )
        return self._client.unzip_recursive(zip_path) if unzip else zip_path

    def open_in_volt(
        self,
        *,
        timestep: int | None = None,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from voltsdk.viewer import open_canvas_view

        return open_canvas_view(
            trajectory_id=self._get('trajectory', ''),
            analysis_id=self.id,
            timestep=timestep,
            volt_url=volt_url,
            open_browser=open_browser,
        )

class AnalysisCollection(BaseCollection['Analysis']):

    def __init__(
        self,
        client: HttpTransport,
        path: str = '',
        params: dict | None = None,
        page_size: int = 100,
    ) -> None:
        super().__init__(client, path=path, resource_cls=Analysis, params=params, page_size=page_size)
