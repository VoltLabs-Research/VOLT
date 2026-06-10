from __future__ import annotations

_DEFAULT_MESH_MATERIAL = {
    'baseColor': [0.8, 0.8, 0.85, 1.0],
    'metallic': 0.05,
    'roughness': 0.9,
    'emissive': [0.0, 0.0, 0.0],
    'doubleSided': True,
}

_DEFAULT_DISLOCATION_MATERIAL = {
    'baseColor': [1.0, 0.5, 0.0, 1.0],
    'metallic': 0.0,
    'roughness': 0.8,
    'emissive': [0.0, 0.0, 0.0],
    'doubleSided': True,
}

_DISLOCATION_TYPE_COLORS = {
    'Other': [0.95, 0.1, 0.1, 1.0],
    '1/2<111>': [0.1, 0.9, 0.1, 1.0],
    '<100>': [1.0, 0.45, 0.74, 1.0],
    '<110>': [0.1, 0.7, 0.95, 1.0],
    '<111>': [0.95, 0.9, 0.1, 1.0],
    '1/6<112>': [0.9, 0.5, 0.1, 1.0],
}

_STRUCTURE_COLORS = {
    'bcc': [102 / 255, 102 / 255, 1.0],
    'fcc': [102 / 255, 1.0, 102 / 255],
    'hcp': [1.0, 102 / 255, 102 / 255],
    'dislocation': [1.0, 0.2, 0.2],
    'ico': [1.0, 165 / 255, 0.0],
    'sc': [160 / 255, 20 / 255, 254 / 255],
    'cubic_diamond': [19 / 255, 160 / 255, 254 / 255],
    'cubic_diamond_first_neigh': [0.0, 254 / 255, 245 / 255],
    'cubic_diamond_second_neigh': [126 / 255, 254 / 255, 181 / 255],
    'hex_diamond': [254 / 255, 137 / 255, 0.0],
    'hex_diamond_first_neigh': [254 / 255, 220 / 255, 0.0],
    'hex_diamond_second_neigh': [204 / 255, 229 / 255, 81 / 255],
    'graphene': [50 / 255, 205 / 255, 50 / 255],
    'unknown': [128 / 255, 128 / 255, 128 / 255],
    'other': [242 / 255, 242 / 255, 242 / 255],
}

def _color_for_type(type_name: str) -> list[float]:
    return _STRUCTURE_COLORS.get(type_name.lower(), _STRUCTURE_COLORS['other'])
