from enum import Enum

class CubicLattices(Enum):
    SC = 'sc'
    BCC = 'bcc'
    CsCl = 'CsCl'
    FCC = 'fcc'
    # L12 = 'L12'
    FLUORITE = 'fluorite'
    ZINCBLENDE = 'zb'
    ROCKSALT = 'rocksalt'
    PEROVSKITE = 'per'
    A15 = 'a15'
    C15 = 'c15'

class TetragonalLattices(Enum):
    ST = 'st'
    BCT = 'bct'
    FCT = 'fct'
    # L10 = 'L1_0'

class HexagonalLattices(Enum):
    HCP = 'hcp'
    WURTZITE = 'wz'
    GRAPHITE = 'graphite'
    # B12 = 'B12
    # C14 = 'C14'
    # C36 = 'C36'