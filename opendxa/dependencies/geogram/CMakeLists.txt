cmake_minimum_required(VERSION 3.20)
project(geogram)

file(GLOB_RECURSE GEOGRAM_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/*.cpp
)

add_library(geogram STATIC ${GEOGRAM_SOURCES})

target_compile_definitions(geogram PUBLIC GARGANTUA=1 GEO_STATIC_LIBS=1)
target_compile_options(geogram PRIVATE
    "-frounding-math" "-ffp-contract=off"
    $<$<CXX_COMPILER_ID:MSVC>:/wd4251;/wd4275;/wd4244;/wd4334>
)
target_include_directories(geogram PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)
find_package(Boost REQUIRED)
find_package(Threads REQUIRED)
target_link_libraries(geogram PUBLIC Threads::Threads Boost::boost)