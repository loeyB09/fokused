FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY app/requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

WORKDIR /app/app

CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT:-8080}"]
