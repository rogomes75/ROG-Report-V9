from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel
import jwt
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = "rog-pool-service-secret-key-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Create the main app
app = FastAPI(title="ROG Pool Service API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Sample data
sample_clients = [
    {
        "id": "1",
        "name": "João Silva",
        "address": "Rua das Flores, 123 - São Paulo",
        "phone": "(11) 99999-9999",
        "email": "joao.silva@email.com",
        "created_at": "2024-06-30T10:00:00"
    },
    {
        "id": "2", 
        "name": "Maria Santos",
        "address": "Av. Paulista, 456 - São Paulo",
        "phone": "(11) 88888-8888",
        "email": "maria.santos@email.com",
        "created_at": "2024-06-30T10:00:00"
    }
]

sample_reports = [
    {
        "id": "1",
        "client_id": "1",
        "title": "Limpeza Completa da Piscina",
        "description": "Limpeza geral da piscina, verificação dos equipamentos e balanceamento químico",
        "status": "reported",
        "priority": "NORMAL",
        "created_at": "2024-06-30T10:00:00",
        "updated_at": "2024-06-30T10:00:00"
    }
]

# Auth functions
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        if username == "admin":
            return UserResponse(id="1", username="admin", role="administrator")
        else:
            raise HTTPException(status_code=401, detail="User not found")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Auth endpoints
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_request: LoginRequest):
    """Login endpoint - accepts admin/admin123"""
    username = login_request.username
    password = login_request.password
    
    # Hardcoded authentication
    if username == "admin" and password == "admin123":
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": username}, expires_delta=access_token_expires
        )
        
        user = UserResponse(id="1", username="admin", role="administrator")
        
        return TokenResponse(
            access_token=access_token,
            user=user
        )
    else:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user information"""
    return current_user

# Main endpoints
@api_router.get("/")
async def root():
    return {"message": "Pool Maintenance API", "timezone": "America/Los_Angeles"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "database": "in-memory"}

# Clients endpoints
@api_router.get("/clients")
async def get_clients(current_user: UserResponse = Depends(get_current_user)):
    return sample_clients

@api_router.get("/reports")
async def get_reports(current_user: UserResponse = Depends(get_current_user)):
    return sample_reports

# Include the router
app.include_router(api_router)

# Mount static files for production
static_dir = Path(__file__).parent.parent / "frontend" / "build"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir / "static"), name="static")
    
    @app.get("/{catchall:path}")
    async def serve_spa(catchall: str):
        # Serve API routes normally
        if catchall.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # For all other routes, serve the React app
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        else:
            return {"error": "Frontend not available"}
    
    @app.get("/")
    async def serve_root():
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        else:
            return {"message": "ROG Pool Service API", "status": "Frontend not available"}

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)