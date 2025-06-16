# docker build -t opendxa-sandbox -f sandbox.Dockerfile .

# Use a thin and secure Python base image
FROM python:3.12-slim

# Install the data analysis libraries
RUN pip install --no-cache-dir numpy pandas matplotlib

# Create a working directory inside the container
WORKDIR /workspace

# Create a non-privileged user to run the code for additional security
RUN useradd --create-home --shell /bin/bash sandboxuser
USER sandboxuser

CMD ["python"]