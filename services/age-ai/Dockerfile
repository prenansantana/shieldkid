FROM python:3.12-slim

WORKDIR /app

# System deps for opencv + insightface build
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 g++ curl tesseract-ocr tesseract-ocr-por && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download InsightFace model (buffalo_l ~300MB)
# This avoids downloading on first request
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])"

COPY main.py .

EXPOSE 8100

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
