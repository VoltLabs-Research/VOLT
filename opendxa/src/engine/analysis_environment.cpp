#include <opendxa/engine/analysis_environment.hpp>
#include <opendxa/logger/logger.hpp>

AnalysisEnvironment::AnalysisEnvironment(){
	timestep = 0;
	pbc[0] = pbc[1] = pbc[2] = true;
	simulationCell = NULL_MATRIX;
	simulationCellOrigin = ORIGIN;
	processor = 0;
}

void AnalysisEnvironment::raiseError(const char* format, ...){
	va_list ap;
	va_start(ap,format);
	char buffer[4096];
	vsprintf(buffer, format, ap);
	va_end(ap);

	throw runtime_error(buffer);
}