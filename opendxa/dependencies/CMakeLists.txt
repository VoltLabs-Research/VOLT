# Set position independent code for all dependencies
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

ADD_SUBDIRECTORY(ptm)

# Geogram is used for DelaunayTessellation
ADD_SUBDIRECTORY(geogram)