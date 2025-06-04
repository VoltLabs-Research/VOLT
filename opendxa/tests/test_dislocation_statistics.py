from opendxa.classification.dislocation_statistics import DislocationStatisticsGenerator
import numpy as np
import pandas as pd
import pytest

def test_generate_line_statistics_table_and_system_properties():
    '''
    Create a single dislocation line and corresponding Burgers vector/IDs.
    Verify line_statistics_table and system_properties values.
    '''
    # Define two points forming a line segment from (0,0,0) to (1,1,1)
    pts = np.array([[0.0, 0.0, 0.0], [1.0, 1.0, 1.0]], dtype=np.float64)
    dislocation_lines = [{'points': pts}]
    # Single loop ID=0 -> Burgers vector [0.5, 0.5, 0.0]
    burgers_vectors = {0: np.array([0.5, 0.5, 0.0])}
    # Suppose atoms 0 and 1 are marked as core for this dislocation
    dislocation_ids = {0: 0, 1: 0, 2: -1}

    # Positions of 3 atoms (third atom irrelevant)
    positions = np.array([[0, 0, 0], [1, 1, 1], [2, 2, 2]], dtype=np.float64)
    # Volume = 1×1×1 = 1 for box [[0,0,0], [1,1,1]]
    box_bounds = np.array([[0.0, 0.0, 0.0], [1.0, 1.0, 1.0]], dtype=np.float64)
    validated_loops = {}  # not used directly here

    gen = DislocationStatisticsGenerator(
        positions=positions,
        box_bounds=box_bounds,
        validated_loops=validated_loops,
        burgers_vectors=burgers_vectors,
        dislocation_ids=dislocation_ids,
        dislocation_lines=dislocation_lines
    )

    # ----- Line statistics -----
    df_lines = gen._generate_line_statistics_table()
    assert isinstance(df_lines, pd.DataFrame)
    assert df_lines.shape[0] == 1
    row = df_lines.iloc[0]

    # Length = sqrt(3)
    expected_length = np.linalg.norm(np.array([1.0, 1.0, 1.0]))
    assert pytest.approx(row['Length'], rel=1e-6) == expected_length

    # Tortuosity = actual_length / straight_length = 1.0
    assert pytest.approx(row['Tortuosity'], rel=1e-6) == 1.0

    # Burgers components match
    assert pytest.approx(row['Burgers_X'], rel=1e-6) == 0.5
    assert pytest.approx(row['Burgers_Y'], rel=1e-6) == 0.5
    assert pytest.approx(row['Burgers_Z'], rel=1e-6) == 0.0

    # Core_Atoms = 2
    assert row['Core_Atoms'] == 2

    # Segments = 1 (two points -> one segment)
    assert row['Segments'] == 1

    # ----- System properties -----
    sys_props = gen._generate_system_properties()
    assert isinstance(sys_props, dict)

    # System_Volume = 1.0
    assert pytest.approx(sys_props['System_Volume'], rel=1e-6) == 1.0

    # Total_Dislocation_Length = sqrt(3)
    assert pytest.approx(sys_props['Total_Dislocation_Length'], rel=1e-6) == expected_length

    # Dislocation_Density = length / volume = sqrt(3) / 1
    assert pytest.approx(sys_props['Dislocation_Density'], rel=1e-6) == expected_length

    # Core_Atoms = 2, Total_Atoms = 3 -> Core_Fraction = 2/3
    assert pytest.approx(sys_props['Core_Atoms'], rel=1e-6) == 2
    assert pytest.approx(sys_props['Core_Fraction'], rel=1e-6) == 2/3