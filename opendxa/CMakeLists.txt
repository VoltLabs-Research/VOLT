cmake_minimum_required(VERSION 3.12)
project(DislocationAnalysis VERSION 1.0 LANGUAGES CXX)

option(DXA_BUILD_EXECUTABLE "Build the standalone DXA executable." ON)
option(DXA_ENABLE_DEBUG "Enable sanity checks (recommended)." ON)
option(DXA_USE_OPENMP "Enable OpenMP parallelization if available." ON)
option(DXA_USE_MKL "Enable Intel MKL acceleration for linear algebra." ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Eigen3 3.3 REQUIRED NO_MODULE)
message(STATUS "Found Eigen3 version: ${Eigen3_VERSION}")

set(MKL_FOUND FALSE)
if(DXA_USE_MKL)
    find_package(MKL QUIET)
    
    if(NOT MKL_FOUND)
        find_package(PkgConfig QUIET)
        if(PkgConfig_FOUND)
            pkg_check_modules(MKL QUIET mkl-dynamic-lp64-iomp)
        endif()
    endif()
    
    if(NOT MKL_FOUND)
        set(MKL_ROOT_PATHS
            $ENV{MKLROOT}
            /opt/intel/mkl
            /opt/intel/oneapi/mkl/latest
            /usr/include/mkl
            /usr/local/include/mkl
        )
        
        find_path(MKL_INCLUDE_DIR mkl.h
            PATHS ${MKL_ROOT_PATHS}
            PATH_SUFFIXES include
        )
        
        find_library(MKL_CORE_LIBRARY mkl_core
            PATHS ${MKL_ROOT_PATHS}
            PATH_SUFFIXES lib lib/intel64 lib/intel64_lin
        )
        
        find_library(MKL_INTEL_LP64_LIBRARY mkl_intel_lp64
            PATHS ${MKL_ROOT_PATHS} 
            PATH_SUFFIXES lib lib/intel64 lib/intel64_lin
        )
        
        find_library(MKL_INTEL_THREAD_LIBRARY mkl_intel_thread
            PATHS ${MKL_ROOT_PATHS}
            PATH_SUFFIXES lib lib/intel64 lib/intel64_lin
        )
        
        if(MKL_INCLUDE_DIR AND MKL_CORE_LIBRARY AND MKL_INTEL_LP64_LIBRARY)
            set(MKL_FOUND TRUE)
            set(MKL_LIBRARIES ${MKL_INTEL_LP64_LIBRARY} ${MKL_INTEL_THREAD_LIBRARY} ${MKL_CORE_LIBRARY})
            set(MKL_INCLUDE_DIRS ${MKL_INCLUDE_DIR})
        endif()
    endif()
    
    if(MKL_FOUND)
        message(STATUS "Intel MKL found - high-performance linear algebra enabled")
        message(STATUS "MKL include dir: ${MKL_INCLUDE_DIRS}")
    else()
        message(WARNING "Intel MKL not found - using standard BLAS/LAPACK")
        set(DXA_USE_MKL OFF)
    endif()
endif()

if(DXA_USE_OPENMP)
    find_package(OpenMP)
    if(OpenMP_CXX_FOUND)
        message(STATUS "OpenMP found - parallel processing enabled")
    else()
        message(WARNING "OpenMP not found - falling back to sequential processing")
    endif()
endif()

add_library(dxa_core
    src/utils/linalg/LinAlg.cpp
    src/geometry/Smoothing.cpp
    src/geometry/Mesh.cpp
    
    src/engine/DislocationExtractionAlgorithm.cpp
    src/engine/SimulationCell.cpp
    src/engine/AnalysisSummary.cpp
    
    src/lattice/FaceCenteredCubic.cpp
    src/lattice/HexagonalClosePacked.cpp
    src/lattice/BaceCenteredCubic.cpp
    
    src/core/Clustering.cpp
    src/core/CommonNeighborAnalysis.cpp
    src/core/InterfaceMesh.cpp
    src/core/DislocationTracing.cpp
    src/core/StackingFaults.cpp
)

# Agregar directorios de include
target_include_directories(dxa_core 
    PUBLIC 
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_compile_definitions(dxa_core PUBLIC
    $<$<BOOL:${DXA_ENABLE_DEBUG}>:DEBUG_DISLOCATIONS>
)

target_link_libraries(dxa_core PUBLIC Eigen3::Eigen)

if(DXA_USE_MKL AND MKL_FOUND)
    target_compile_definitions(dxa_core PUBLIC
        EIGEN_USE_MKL_ALL
        MKL_LP64
        DXA_USE_MKL
    )
    
    target_include_directories(dxa_core PUBLIC ${MKL_INCLUDE_DIRS})
    target_link_libraries(dxa_core PUBLIC ${MKL_LIBRARIES})
    
    target_compile_options(dxa_core PUBLIC
        $<$<CXX_COMPILER_ID:GNU>:-m64 -fopenmp>
        $<$<CXX_COMPILER_ID:Intel>:-mkl=parallel>
        $<$<CXX_COMPILER_ID:Clang>:-m64>
    )
    
    if(UNIX AND NOT APPLE)
        target_link_libraries(dxa_core PUBLIC pthread dl m)
    endif()
else()
    target_compile_definitions(dxa_core PUBLIC
        EIGEN_DONT_PARALLELIZE
    )
endif()

if(DXA_USE_OPENMP AND OpenMP_CXX_FOUND)
    target_link_libraries(dxa_core PUBLIC OpenMP::OpenMP_CXX)
    target_compile_definitions(dxa_core PUBLIC DXA_USE_OPENMP)
    
    if(NOT (DXA_USE_MKL AND MKL_FOUND))
        target_compile_definitions(dxa_core PUBLIC EIGEN_USE_THREADS)
    endif()
endif()

target_compile_options(dxa_core PRIVATE
    $<$<CXX_COMPILER_ID:GNU>:-Wall -Wextra -O3 -march=native -ffast-math>
    $<$<CXX_COMPILER_ID:Clang>:-Wall -Wextra -O3 -march=native -ffast-math>
    $<$<CXX_COMPILER_ID:Intel>:-Wall -O3 -xHost -fp-model fast=2>
    $<$<CXX_COMPILER_ID:MSVC>:/W4 /O2 /fp:fast>
)

if(DXA_BUILD_EXECUTABLE)
    find_package(OpenGL REQUIRED)
    message(STATUS "OpenGL found - visualization support enabled")

    add_executable(opendxa 
        src/Main.cpp
        src/parser/Parser.cpp
        src/parser/LammpsParser.cpp
    )

    target_link_libraries(opendxa PRIVATE 
        dxa_core 
        OpenGL::GLU
    )
    
    target_compile_options(opendxa PRIVATE
        $<$<CXX_COMPILER_ID:GNU>:-O3 -march=native -ffast-math>
        $<$<CXX_COMPILER_ID:Clang>:-O3 -march=native -ffast-math>
        $<$<CXX_COMPILER_ID:Intel>:-O3 -xHost -fp-model fast=2>
        $<$<CXX_COMPILER_ID:MSVC>:/O2 /fp:fast>
    )
endif()

message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "Build executable: ${DXA_BUILD_EXECUTABLE}")
message(STATUS "Debug mode: ${DXA_ENABLE_DEBUG}")
message(STATUS "OpenMP support: ${DXA_USE_OPENMP}")
if(DXA_USE_OPENMP AND OpenMP_CXX_FOUND)
    message(STATUS "OpenMP version: ${OpenMP_CXX_VERSION}")
endif()
message(STATUS "Eigen3 version: ${Eigen3_VERSION}")
message(STATUS "Intel MKL support: ${DXA_USE_MKL}")
if(DXA_USE_MKL AND MKL_FOUND)
    message(STATUS "MKL libraries: ${MKL_LIBRARIES}")
endif()

install(TARGETS dxa_core
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
)

if(DXA_BUILD_EXECUTABLE)
    install(TARGETS opendxa
        RUNTIME DESTINATION bin
    )
endif()

option(DXA_BUILD_TESTS "Build unit tests" OFF)
if(DXA_BUILD_TESTS)
    enable_testing()
    message(STATUS "Unit tests enabled")
endif()