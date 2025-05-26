from pydantic import BaseModel
from typing import List

class FileInfo(BaseModel):
    filename: str
    size: int
    timesteps: List[int]
    atoms_count: int