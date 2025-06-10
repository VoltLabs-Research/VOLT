#ifndef __DXA_PARSER_STREAM_H
#define __DXA_PARSER_STREAM_H

#include "../Includes.hpp"

class ParserStream{
public:
	ParserStream(istream& stream) : _lineNumber(0), _file_stream(stream) {}

	const string& readline() {
		if(_file_stream.eof()) throw runtime_error("File parsing error. Unexpected end of file");
		getline(_file_stream, _line);
		if(!_file_stream && !_file_stream.eof()) throw runtime_error("File parsing error. An I/O error occured.");
		_lineNumber++;
		return _line;
	}

	void read(void* buffer, streamsize n) {
		_file_stream.read((char*)buffer, n);
		if(_file_stream.gcount() != n)
			throw runtime_error("File parsing error. Unexpected end of file");
		if(!_file_stream && !_file_stream.eof())
			throw runtime_error("File parsing error. An I/O error occured.");
	}

	bool eof() { return _file_stream.eof(); }
	const string& line() const { return _line; }
	int lineNumber() const { return _lineNumber; }

private:
	string _line;
	int _lineNumber;
	istream& _file_stream;
};

#endif 

