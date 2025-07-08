from opendxa import DislocationAnalysis, LatticeStructureType

analyzer = DislocationAnalysis()

analyzer.set_input_crystal_structure(LatticeStructureType.FCC)
analyzer.set_max_trial_circuit_size(14)
analyzer.set_circuit_stretchability(9)
analyzer.set_only_perfect_dislocations(False)
    
# results = analyzer.compute_trajectory([
#    # TODO: static void OpenDXA::CoordinationStructures::calculateProductForPermutation(OpenDXA::LatticeStructure&, size_t, size_t): Assertion `latticeStruct.permutations[s1].product.size() == s2 + 1' failed.
#    '/home/rodyherrera/Escritorio/OpenDXA/debug.analysis.dump',
#    '/home/rodyherrera/Escritorio/OpenDXA/debug.analysis.dump',
#    '/home/rodyherrera/Escritorio/OpenDXA/debug.analysis.dump',
#    '/home/rodyherrera/Escritorio/OpenDXA/debug.analysis.dump',
#    '/home/rodyherrera/Escritorio/OpenDXA/debug.analysis.dump'
#], 'dislocation_results_%i.json')

result = analyzer.compute('/home/rodyherrera/Escritorio/OpenDXA/dump.ensayo.1175000.config', 'results.json')