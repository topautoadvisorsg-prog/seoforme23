# SmartClix — single-image production build.
# Stage 1 builds the React app; stage 2 runs FastAPI which serves both the
# built app and the /api routes from one origin.

# ---- stage 1: build the frontend ----
FROM node:20-bookworm-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./
# Empty backend URL => the app calls /api on its own origin (same service).
ENV REACT_APP_BACKEND_URL=""
ENV CI=false
RUN npm run build

# ---- stage 2: backend + serve ----
FROM python:3.12-slim AS app
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /fe/build ./frontend_build
ENV FRONTEND_BUILD_DIR=/app/frontend_build
# Railway injects $PORT; default to 8001 for local `docker run`.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
