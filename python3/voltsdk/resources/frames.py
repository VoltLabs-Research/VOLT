"""Frame resource and collection.

A :class:`Frame` represents a single timestep in a trajectory.  Frames
are typically sourced from the trajectory metadata (``trajectory.frames``
array) so no extra API call is needed to enumerate them.

:class:`FrameCollection` is a lightweight wrapper that supports
``__getitem__``, ``__iter__``, ``__len__``, and ``to_dataframe()``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd
    from voltsdk.http import HttpTransport


class Frame:
    """Represents a single timestep frame in a trajectory."""

    def __init__(
        self,
        client: HttpTransport,
        trajectory_id: str,
        data: dict,
    ) -> None:
        self._client = client
        self._trajectory_id = trajectory_id
        self._data = data

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def timestep(self) -> int:
        return self._data.get('timestep', 0)

    @property
    def natoms(self) -> int:
        return self._data.get('natoms', 0)

    @property
    def raw(self) -> dict:
        return self._data

    # ------------------------------------------------------------------
    # Data access
    # ------------------------------------------------------------------

    def atoms(
        self,
        analysis_id: str = 'default',
        page: int = 1,
        limit: int = 10_000,
    ) -> pd.DataFrame:
        """Fetch atom data for this frame as a DataFrame.

        Returns a DataFrame with columns such as ``id``, ``type``,
        ``x``, ``y``, ``z``, plus any additional per-atom properties.
        """
        import pandas as _pd

        team_id = self._client.team_id
        data = self._client.get(
            f'/trajectories/{team_id}/{self._trajectory_id}/atoms',
            params={
                'timestep': self.timestep,
                'analysisId': analysis_id,
                'page': page,
                'limit': limit,
            },
        )
        rows = data.get('data', data) if isinstance(data, dict) else data
        if isinstance(rows, list):
            return _pd.DataFrame(rows)
        return _pd.DataFrame()

    # ------------------------------------------------------------------
    # Downloads
    # ------------------------------------------------------------------

    def download_dump(self, dest: str = '.') -> str:
        """Download the raw LAMMPS dump file for this frame."""
        team_id = self._client.team_id
        return self._client.download_stream(
            f'/trajectories/{team_id}/{self._trajectory_id}/download',
            fallback_name=f'timestep-{self.timestep}.dump.gz',
            dest=dest,
            params={'timestep': self.timestep},
        )

    def download_glb(
        self,
        analysis_id: str = 'default',
        dest: str = '.',
    ) -> str:
        """Download the GLB 3D model for this frame."""
        team_id = self._client.team_id
        return self._client.download_stream(
            f'/trajectories/{team_id}/{self._trajectory_id}/glb/{self.timestep}/{analysis_id}',
            fallback_name=f'frame-{self.timestep}.glb',
            dest=dest,
        )

    def open_in_volt(
        self,
        analysis_id: str = 'default',
        *,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from voltsdk.viewer import open_canvas_view

        return open_canvas_view(
            trajectory_id=self._trajectory_id,
            analysis_id=analysis_id,
            timestep=self.timestep,
            volt_url=volt_url,
            open_browser=open_browser,
        )

    # ------------------------------------------------------------------
    # OVITO integration
    # ------------------------------------------------------------------

    def to_ovito_data(self):
        """Load this frame into an OVITO ``DataCollection``."""
        from voltsdk.integrations.ovito import frame_to_data
        return frame_to_data(self)

    # ------------------------------------------------------------------
    # Dunder
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return f'<Frame timestep={self.timestep} natoms={self.natoms}>'


class FrameCollection:
    """Collection of :class:`Frame` objects for a trajectory.

    Frames are constructed from the trajectory metadata array, so no
    extra API call is required.  Supports ``__iter__``, ``__getitem__``,
    ``__len__``, and ``to_dataframe()``.
    """

    def __init__(
        self,
        client: HttpTransport,
        trajectory_id: str,
        frames_data: list[dict],
    ) -> None:
        self._client = client
        self._trajectory_id = trajectory_id
        self._frames = [
            Frame(client, trajectory_id, fd) for fd in frames_data
        ]

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def from_trajectory_data(
        cls,
        client: HttpTransport,
        trajectory_id: str,
        raw_frames: list[dict],
    ) -> FrameCollection:
        """Create a :class:`FrameCollection` from a trajectory's ``frames`` array."""
        return cls(client, trajectory_id, raw_frames)

    # ------------------------------------------------------------------
    # Sequence protocol
    # ------------------------------------------------------------------

    def __iter__(self):
        return iter(self._frames)

    def __getitem__(self, index: int) -> Frame:
        return self._frames[index]

    def __len__(self) -> int:
        return len(self._frames)

    def __bool__(self) -> bool:
        return len(self._frames) > 0

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def list(self) -> list[Frame]:
        """Return all frames as a plain list."""
        return list(self._frames)

    def first(self) -> Frame | None:
        """Return the first frame, or ``None`` if empty."""
        return self._frames[0] if self._frames else None

    def to_dataframe(self) -> pd.DataFrame:
        """Convert frame metadata to a :class:`~pandas.DataFrame`."""
        import pandas as _pd
        return _pd.DataFrame([f.raw for f in self._frames])

    def __repr__(self) -> str:
        return f'<FrameCollection count={len(self._frames)}>'
