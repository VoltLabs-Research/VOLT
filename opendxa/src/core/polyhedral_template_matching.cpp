#include <opendxa/core/clustering.hpp>
#include <opendxa/utils/timer.hpp>

struct NeighborData{
    const std::vector<InputAtom>* allAtoms;
    const Clustering* clustering;
};

// This function will be called by the PTM library for each atom.
static int getNeighbors(void *vdata, size_t, size_t atom_index, int num_requested, ptm_atomicenv_t* env){
    // Reinterpret user data to gain context
    NeighborData* data = static_cast<NeighborData*>(vdata);
    const InputAtom &centralAtom = (*data->allAtoms)[atom_index];

    // Fill in the information of the central atom
    env->atom_indices[0] = atom_index;
    env->points[0][0] = 0.0;
    env->points[0][1] = 0.0;
    env->points[0][2] = 0.0;

    // Fill out the neighbors' information
    // We take at most the neighbors that PTM can handle or the ones that the atom has.
    int numNeighborsToProcess = std::min((int)centralAtom.numNeighbors, PTM_MAX_INPUT_POINTS - 1);
    for(int i = 0; i < numNeighborsToProcess; ++i){
        const InputAtom* neighborAtom = centralAtom.neighborAtom(i);

        // Calculate the displacement vector (delta), applying PBC
        Vector3 delta = data->clustering->neighborListBuilder.wrapVector(neighborAtom->pos - centralAtom.pos);
        env->atom_indices[i + 1] = neighborAtom->tag;
        env->points[i + 1][0] = delta.x();
        env->points[i + 1][1] = delta.y();
        env->points[i + 1][2] = delta.z();
    }

    // PTM uses 'num' for the total number of points (central atom + neighbors)
    env->num = numNeighborsToProcess + 1;

    // The function should return the number of filled points
    return env->num;
}

void Clustering::performPTM(){
    LOG_INFO() << "Performing Polyhedral Template Matching (PTM).";
    ptm_initialize_global();
    
    Timer timer;
    size_t numFCC = 0;
    size_t numHCP = 0;
    size_t numBCC = 0;

    // Environment where the callback will write the data
    ptmLocalHandle = ptm_initialize_local();
    ptm_atomicenv_t ptmEnv;

    for(int i = 0; i < inputAtoms.size(); ++i){
        // Prepare the data for the callback
        NeighborData neighborData;
        neighborData.allAtoms = &inputAtoms;
        neighborData.clustering = this;

        // Setting and calling ptm_index
        ptm_result_t result;

        // Structures to identify
        int flags = PTM_CHECK_FCC | PTM_CHECK_HCP | PTM_CHECK_BCC;

        int errorCode = ptm_index(
            // Handle of the current thread
            ptmLocalHandle,
            // Index of the atom to be analyzed
            i,
            // Our callback function
            getNeighbors,
            // Pointer to our data, which will be passed to the callback
            &neighborData,
            // What structures to look for
            flags,
            // calculate_deformation_gradient (optional)
            false,
            // Where to store the results
            &result,
            // Where the callback should write the neighbors' data
            &ptmEnv
        );

        if(errorCode != PTM_NO_ERROR){
            continue;
        }

        // Typical threshold for PTM
        double rmsd_cutoff = 0.12;

        // Interpret the results and update InputAtom
        if(result.structure_type == PTM_MATCH_NONE || result.rmsd > rmsd_cutoff){
            inputAtoms[i].setCNAType(OTHER);
            inputAtoms[i].latticeOrientation = IDENTITY;
        }else{
            // Assign structure type
            switch(result.structure_type){
                case PTM_MATCH_FCC:
                    inputAtoms[i].setCNAType(FCC);
                    numFCC++;
                    break;
                case PTM_MATCH_HCP:
                    inputAtoms[i].setCNAType(HCP);
                    numHCP++;
                    break;
                case PTM_MATCH_BCC:
                    inputAtoms[i].setCNAType(BCC);
                    numBCC++;
                    break;
                default:
                    inputAtoms[i].setCNAType(OTHER);
                    break;
            }

            Quaternion q(result.orientation[1], result.orientation[2], result.orientation[3], result.orientation[0]);
            inputAtoms[i].latticeOrientation = Matrix3(q);
        }
    }

    // Release thread resources
    ptm_uninitialize_local(ptmLocalHandle);


    LOG_INFO() << "Number of FCC atoms: " << numFCC 
               << "   Number of HCP atoms: " << numHCP 
               << "   Number of BCC atoms: " << numBCC;
	LOG_INFO() << "PTM analysis time: " << timer.elapsedTime() << " sec.";
}