# Multi-stage Dockerfile for React + FastAPI

# Frontend Build Stage
FROM node:18-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
RUN yarn build

# Backend Stage
FROM python:3.11-slim as backend
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Production Stage
FROM python:3.11-slim
WORKDIR /app

# Install Node.js for serving React app
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY --from=backend /app ./backend
COPY --from=backend /root/.local /root/.local

# Copy frontend build
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Install serve for React app
RUN npm install -g serve

# Create startup script
RUN echo '#!/bin/bash\n\
# Start backend\n\
cd /app/backend && python -m uvicorn server:app --host 0.0.0.0 --port 8001 &\n\
# Start frontend\n\
cd /app/frontend && serve -s build -l 3000 -p 3000 &\n\
# Wait for any process to exit\n\
wait -n\n\
# Exit with status of process that exited first\n\
exit $?' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000 8001

CMD ["/app/start.sh"]