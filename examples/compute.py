from opendxa import DislocationAnalysis, LatticeStructureType

analyzer = DislocationAnalysis()

analyzer.set_input_crystal_structure(LatticeStructureType.FCC)
analyzer.set_max_trial_circuit_size(14)
analyzer.set_circuit_stretchability(9)
analyzer.set_only_perfect_dislocations(False)
    
results = analyzer.compute('/home/rodyherrera/Escritorio/OpenDXA/debug.analysis.dump', 'dislocation_results.json')