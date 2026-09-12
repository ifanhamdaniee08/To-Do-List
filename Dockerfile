# 1. Base Image: Python 3.10 slim
FROM python:3.10-slim

# 2. Set working directory in container
WORKDIR /app

# 3. Install system dependencies required for PostgreSQL and compilers
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy requirements first to leverage Docker layer caching
COPY backend/requirements.txt .

# 5. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy backend and frontend source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 7. Expose application port
EXPOSE 5000

# 8. Environment variables
ENV PYTHONUNBUFFERED=1

# 9. Start command
CMD ["python", "backend/app.py"]
