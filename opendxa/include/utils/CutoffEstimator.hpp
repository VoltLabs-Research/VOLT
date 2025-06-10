#include "../Includes.hpp"
#include "structures/Atoms.hpp"

// TODO: Duplicated code. Already exists a nearest neighbor finder.
static double findNearestNeighbor(const std::vector<InputAtom>& atoms, size_t centerIndex){
    const Point3& centerPos = atoms[centerIndex].pos;
    double minDistSq = std::numeric_limits<double>::max();
    for(size_t i = 0; i < atoms.size(); ++i){
        if(i == centerIndex) continue;
        Vector3 diff = atoms[i].pos - centerPos;
        double distSq = diff.X * diff.X + diff.Y * diff.Y + diff.Z * diff.Z;
        if(distSq < minDistSq){
            minDistSq = distSq;
        }
    }

    return sqrt(minDistSq);
}

static double estimateCutoff(const std::vector<InputAtom>& atoms, const Matrix3& cell){
    if(atoms.empty()) return 3.0;
    std::cout << "Estimating CNA cutoff from " << atoms.size() << " atoms..." << std::endl;
    // first, using nearest neighbor
    std::vector<double> nearestDistances;
    size_t sampleSize = std::min(size_t(500), atoms.size());
    size_t step = atoms.size() / sampleSize;
    if(step == 0) step = 1;

    for(size_t i = 0; i < atoms.size(); i += step){
        double dist = findNearestNeighbor(atoms, i);
        if(dist > 0.5 && dist < 6.0){
            nearestDistances.push_back(dist);
        }
    }

    double cutoff1 = 3.0;
    if(!nearestDistances.empty()){
        std::sort(nearestDistances.begin(), nearestDistances.end());
        size_t index75 = static_cast<size_t>(nearestDistances.size() * 0.75);
        cutoff1 = nearestDistances[index75] * 1.25;
    }

    // now, density-based approach
    double volume = std::abs(cell.determinant());
    double cutoff2 = 3.0;
    if(volume > 0.0){
        double density = static_cast<double>(atoms.size()) / volume;
        cutoff2 = 1.4 * pow(1.0 / density, 1.0/3.0);
    }

    // combine methods and apply criteria
    double ratio = std::max(cutoff1, cutoff2) / std::min(cutoff1, cutoff2);
    double finalCutoff = (ratio > 2.0) ? std::min(cutoff1, cutoff2) * 1.2 : 0.4 * cutoff1 + 0.6 * cutoff2;
    finalCutoff = std::max(2.0, std::min(4.5, finalCutoff));
    std::cout << "  - Neighbor-based: " << cutoff1 << " Å" << std::endl;
    std::cout << "  - Density-based: " << cutoff2 << " Å" << std::endl;
    std::cout << "  - Final cutoff: " << finalCutoff << " Å" << std::endl;
    return finalCutoff; 
}