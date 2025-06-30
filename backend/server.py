from fastapi import FastAPI, HTTPException, APIRouter, Depends, status, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import base64
import pandas as pd
from io import BytesIO
import pytz
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Los Angeles timezone
LA_TZ = pytz.timezone('America/Los_Angeles')

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'rog-pool-service-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI(title="ROG Pool Service API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Global variables for MongoDB
mongodb_available = False
client = None
db = None

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "employee"

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str = "employee"
    created_at: datetime = Field(default_factory=datetime.now)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    employee_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class ServiceReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    client_name: str
    client_address: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    description: str
    priority: str = "SAME WEEK"  # URGENT, SAME WEEK, NEXT WEEK
    status: str = "reported"  # reported, scheduled, in_progress, completed
    photos: Optional[List[str]] = []
    videos: Optional[List[str]] = []
    employee_notes: Optional[str] = None
    admin_notes: Optional[str] = None
    total_cost: Optional[float] = 0.0
    parts_cost: Optional[float] = 0.0
    request_date: datetime = Field(default_factory=datetime.now)
    completion_date: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    modification_history: Optional[List[Dict]] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

# Auth functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
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
        
        if not mongodb_available:
            # Fallback for basic auth
            if username == "admin":
                return User(id="1", username="admin", role="administrator")
            return User(id="2", username=username, role="employee")
        
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

@app.on_event("startup")
async def startup_event():
    global mongodb_available, client, db
    
    try:
        # Try multiple environment variables for MongoDB URL
        mongo_url = (
            os.environ.get('MONGODB_URL') or 
            os.environ.get('DATABASE_URL') or 
            os.environ.get('MONGO_URL') or
            'mongodb://localhost:27017'
        )
        
        db_name = os.environ.get('DB_NAME', 'rog_pool_service')
        
        logger.info(f"Attempting MongoDB connection...")
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Test connection
        await db.test_collection.find_one()
        mongodb_available = True
        logger.info("✅ MongoDB connected successfully!")
        
        # Create initial data if needed
        await initialize_default_data()
        
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        mongodb_available = False
        client = None
        db = None

async def initialize_default_data():
    """Create default data if database is empty"""
    if not mongodb_available or db is None:
        return
    
    try:
        # Create admin user if doesn't exist
        admin_user = await db.users.find_one({"username": "admin"})
        if not admin_user:
            admin_data = {
                "id": str(uuid.uuid4()),
                "username": "admin",
                "password_hash": get_password_hash("admin123"),
                "role": "administrator",
                "created_at": datetime.now()
            }
            await db.users.insert_one(admin_data)
            logger.info("✅ Created admin user")

        # Create sample employees
        employee_count = await db.users.count_documents({"role": "employee"})
        if employee_count == 0:
            sample_employees = [
                {
                    "id": str(uuid.uuid4()),
                    "username": "employee1",
                    "password_hash": get_password_hash("password123"),
                    "role": "employee",
                    "created_at": datetime.now()
                },
                {
                    "id": str(uuid.uuid4()),
                    "username": "employee2", 
                    "password_hash": get_password_hash("password123"),
                    "role": "employee",
                    "created_at": datetime.now()
                }
            ]
            await db.users.insert_many(sample_employees)
            logger.info(f"✅ Created {len(sample_employees)} sample employees")

        # Create sample clients
        client_count = await db.clients.count_documents({})
        if client_count == 0:
            sample_clients = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "João Silva",
                    "address": "Rua das Flores, 123 - São Paulo",
                    "phone": "(11) 99999-9999",
                    "email": "joao.silva@email.com",
                    "employee_id": None,
                    "created_at": datetime.now()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Maria Santos",
                    "address": "Av. Paulista, 456 - São Paulo",
                    "phone": "(11) 88888-8888", 
                    "email": "maria.santos@email.com",
                    "employee_id": None,
                    "created_at": datetime.now()
                }
            ]
            
            await db.clients.insert_many(sample_clients)
            logger.info(f"✅ Created {len(sample_clients)} sample clients")
            
            # Create sample service report
            sample_report = {
                "id": str(uuid.uuid4()),
                "client_id": sample_clients[0]["id"],
                "client_name": sample_clients[0]["name"],
                "client_address": sample_clients[0]["address"],
                "description": "Limpeza Completa da Piscina - Limpeza geral da piscina, verificação dos equipamentos e balanceamento químico",
                "priority": "SAME WEEK",
                "status": "reported",
                "photos": [],
                "videos": [],
                "employee_notes": "Cliente solicitou serviço completo",
                "admin_notes": None,
                "total_cost": 0.0,
                "parts_cost": 0.0,
                "request_date": datetime.now(),
                "completion_date": None,
                "last_modified": datetime.now(),
                "modification_history": [],
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            await db.service_reports.insert_one(sample_report)
            logger.info("✅ Created sample service report")
            
    except Exception as e:
        logger.error(f"Error initializing default data: {e}")

# Auth endpoints
@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_request: LoginRequest):
    """Login endpoint"""
    username = login_request.username
    password = login_request.password
    
    # Check if MongoDB is available
    if mongodb_available and db is not None:
        try:
            user = await db.users.find_one({"username": username})
            if user and verify_password(password, user["password_hash"]):
                access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                access_token = create_access_token(
                    data={"sub": username}, expires_delta=access_token_expires
                )
                
                user_data = User(
                    id=user["id"],
                    username=user["username"], 
                    role=user["role"]
                )
                
                return TokenResponse(
                    access_token=access_token,
                    user=user_data
                )
        except Exception as e:
            logger.error(f"Database login error: {e}")
    
    # Fallback hardcoded authentication
    if username == "admin" and password == "admin123":
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": username}, expires_delta=access_token_expires
        )
        
        user = User(id="1", username="admin", role="administrator")
        
        return TokenResponse(
            access_token=access_token,
            user=user
        )
    
    raise HTTPException(
        status_code=401,
        detail="Invalid username or password"
    )

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@api_router.get("/")
def root():
    return {"message": "Pool Maintenance API", "timezone": "America/Los_Angeles"}

@api_router.get("/health")
def health():
    return {
        "status": "healthy", 
        "service": "rog-pool-service",
        "version": "7.0",
        "mongodb": "connected" if mongodb_available else "disconnected"
    }

# User Management endpoints
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "administrator":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not mongodb_available:
        return []
    
    try:
        users = await db.users.find().to_list(1000)
        return [User(**user) for user in users]
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return []

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "administrator":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Check if user exists
        existing_user = await db.users.find_one({"username": user_data.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        user_dict = {
            "id": str(uuid.uuid4()),
            "username": user_data.username,
            "password_hash": get_password_hash(user_data.password),
            "role": user_data.role,
            "created_at": datetime.now()
        }
        
        await db.users.insert_one(user_dict)
        
        return User(
            id=user_dict["id"],
            username=user_dict["username"],
            role=user_dict["role"],
            created_at=user_dict["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating user: {e}")

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "administrator":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Don't allow deleting admin user
        user_to_delete = await db.users.find_one({"id": user_id})
        if user_to_delete and user_to_delete["username"] == "admin":
            raise HTTPException(status_code=400, detail="Cannot delete admin user")
        
        result = await db.users.delete_one({"id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "User deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting user: {e}")

# Client endpoints
@api_router.get("/clients", response_model=List[Client])
async def get_clients(current_user: User = Depends(get_current_user)):
    if not mongodb_available:
        return []
    
    try:
        clients = await db.clients.find().to_list(1000)
        return [Client(**client) for client in clients]
    except Exception as e:
        logger.error(f"Error fetching clients: {e}")
        return []

@api_router.post("/clients", response_model=Client)
async def create_client(client: Client, current_user: User = Depends(get_current_user)):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        await db.clients.insert_one(client.dict())
        return client
    except Exception as e:
        logger.error(f"Error creating client: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating client: {e}")

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_user: User = Depends(get_current_user)):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        result = await db.clients.delete_one({"id": client_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Client not found")
        
        return {"message": "Client deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting client: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting client: {e}")

@api_router.post("/clients/import-excel")
async def import_clients_excel(
    file: UploadFile = File(...),
    employee_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
        
        # Validate required columns
        required_columns = ['Name', 'Address']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(status_code=400, detail="Excel file must have 'Name' and 'Address' columns")
        
        # Import clients
        imported_count = 0
        for _, row in df.iterrows():
            if pd.notna(row['Name']) and pd.notna(row['Address']):
                client_data = {
                    "id": str(uuid.uuid4()),
                    "name": str(row['Name']).strip(),
                    "address": str(row['Address']).strip(),
                    "phone": str(row.get('Phone', '')).strip() if pd.notna(row.get('Phone')) else None,
                    "email": str(row.get('Email', '')).strip() if pd.notna(row.get('Email')) else None,
                    "employee_id": employee_id,
                    "created_at": datetime.now()
                }
                
                # Check for duplicates
                existing = await db.clients.find_one({
                    "name": client_data["name"],
                    "address": client_data["address"]
                })
                
                if not existing:
                    await db.clients.insert_one(client_data)
                    imported_count += 1
        
        return {"message": f"Successfully imported {imported_count} clients"}
    
    except Exception as e:
        logger.error(f"Error importing Excel: {e}")
        raise HTTPException(status_code=500, detail=f"Error importing Excel file: {e}")

# Service Report endpoints
@api_router.get("/reports", response_model=List[ServiceReport])
async def get_reports(current_user: User = Depends(get_current_user)):
    if not mongodb_available:
        return []
    
    try:
        reports = await db.service_reports.find().sort("created_at", -1).to_list(1000)
        return [ServiceReport(**report) for report in reports]
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        return []

@api_router.post("/reports", response_model=ServiceReport)
async def create_report(report: ServiceReport, current_user: User = Depends(get_current_user)):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get client info
        client = await db.clients.find_one({"id": report.client_id})
        if client:
            report.client_name = client["name"]
            report.client_address = client["address"]
        
        # Set employee info
        if current_user.role == "employee":
            report.employee_id = current_user.id
            report.employee_name = current_user.username
        
        await db.service_reports.insert_one(report.dict())
        return report
    except Exception as e:
        logger.error(f"Error creating report: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating report: {e}")

@api_router.put("/reports/{report_id}", response_model=ServiceReport)
async def update_report(report_id: str, updated_report: ServiceReport, current_user: User = Depends(get_current_user)):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get existing report
        existing_report = await db.service_reports.find_one({"id": report_id})
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Update timestamp and modification history
        updated_report.updated_at = datetime.now()
        updated_report.last_modified = datetime.now()
        
        # Track changes
        changes = []
        if updated_report.status != existing_report.get("status"):
            changes.append(f"Status: {existing_report.get('status')} → {updated_report.status}")
            
            # Set completion date if completed
            if updated_report.status == "completed":
                updated_report.completion_date = datetime.now()
        
        if changes:
            modification_entry = {
                "modified_at": datetime.now(),
                "modified_by": current_user.username,
                "modified_by_role": current_user.role,
                "changes": changes
            }
            
            if not updated_report.modification_history:
                updated_report.modification_history = []
            updated_report.modification_history.append(modification_entry)
        
        result = await db.service_reports.update_one(
            {"id": report_id},
            {"$set": updated_report.dict()}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return updated_report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating report: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating report: {e}")

# Include the router in the main app
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)