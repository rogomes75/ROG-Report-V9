from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import jwt
from passlib.context import CryptContext
import base64
import pandas as pd
from io import BytesIO
import pytz

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Los Angeles timezone
LA_TZ = pytz.timezone('America/Los_Angeles')

def get_la_time():
    return datetime.now(LA_TZ)

def get_la_time_str():
    return get_la_time().strftime("%H:%M")

# MongoDB connection - Railway Plugin Priority with URL encoding
import urllib.parse

def encode_mongo_url(mongo_url):
    """Safely encode MongoDB URL to handle special characters"""
    if not mongo_url or 'mongodb' not in mongo_url:
        return mongo_url
    
    try:
        # If it's a mongodb+srv URL, handle encoding
        if mongo_url.startswith('mongodb+srv://'):
            # Extract components
            parts = mongo_url.replace('mongodb+srv://', '').split('@')
            if len(parts) == 2:
                auth_part = parts[0]
                url_part = parts[1]
                
                # Split username:password
                if ':' in auth_part:
                    username, password = auth_part.split(':', 1)
                    # Encode username and password
                    username_encoded = urllib.parse.quote_plus(username)
                    password_encoded = urllib.parse.quote_plus(password)
                    # Reconstruct URL
                    return f"mongodb+srv://{username_encoded}:{password_encoded}@{url_part}"
        
        return mongo_url
    except Exception as e:
        logging.error(f"Error encoding MongoDB URL: {e}")
        return mongo_url

mongo_url_raw = os.environ.get('DATABASE_URL', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
mongo_url = encode_mongo_url(mongo_url_raw)
db_name = os.environ.get('DB_NAME', 'pool_maintenance_db')

# Add error handling for MongoDB connection
try:
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    logging.info(f"MongoDB connected successfully")
except Exception as e:
    logging.error(f"MongoDB connection failed: {e}")
    # Use fallback for development
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['pool_maintenance_db']

# Security
SECRET_KEY = "pool_maintenance_secret_key_2024"
ALGORITHM = "HS256"
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Startup/Shutdown logic using lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Check if admin user exists, if not create one
    admin_user = await db.users.find_one({"username": "admin"})
    if not admin_user:
        admin_user_data = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password_hash": get_password_hash("admin123"),
            "role": "admin",
            "created_at": get_la_time()
        }
        await db.users.insert_one(admin_user_data)
        logging.info("Admin user created")
    
    # Create a new test admin user
    test_admin = await db.users.find_one({"username": "testadmin"})
    if not test_admin:
        test_admin_data = {
            "id": str(uuid.uuid4()),
            "username": "testadmin",
            "password_hash": get_password_hash("test123"),
            "role": "admin",
            "created_at": get_la_time()
        }
        await db.users.insert_one(test_admin_data)
        logging.info("Test admin user created: testadmin/test123")
    
    yield
    # Shutdown
    client.close()

# Create the main app with lifespan
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str  # "admin" or "employee"
    created_at: datetime = Field(default_factory=get_la_time)

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "employee"

class UserLogin(BaseModel):
    username: str
    password: str

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    employee_id: Optional[str] = None  # For per-user client lists
    created_at: datetime = Field(default_factory=get_la_time)

class ServiceReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    client_name: str
    client_address: str = ""
    employee_id: str
    employee_name: str
    description: str
    photos: List[str] = []  # base64 encoded images
    videos: List[str] = []  # base64 encoded videos
    priority: str  # "URGENT", "SAME WEEK", "NEXT WEEK"
    status: str = "reported"  # "reported", "scheduled", "in_progress", "completed"
    request_date: datetime = Field(default_factory=get_la_time)
    completion_date: Optional[datetime] = None
    admin_notes: str = ""
    employee_notes: str = ""
    created_at: datetime = Field(default_factory=get_la_time)
    created_time: str = Field(default_factory=get_la_time_str)
    last_modified: datetime = Field(default_factory=get_la_time)
    modification_history: List[dict] = []
    # Financial fields (admin only)
    total_cost: Optional[float] = 0.0
    parts_cost: Optional[float] = 0.0
    gross_profit: Optional[float] = 0.0

class ServiceReportCreate(BaseModel):
    client_id: str
    description: str
    photos: List[str] = []
    videos: List[str] = []
    priority: str

class ServiceReportUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    employee_notes: Optional[str] = None
    completion_date: Optional[datetime] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    photos: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    total_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    gross_profit: Optional[float] = None

# Helper functions
def create_access_token(data: dict):
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Pool Maintenance API", "timezone": "America/Los_Angeles"}

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    logging.info(f"Login attempt for username: {user_data.username}")
    user = await db.users.find_one({"username": user_data.username})
    if not user:
        logging.warning(f"User not found: {user_data.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(user_data.password, user["password_hash"]):
        logging.warning(f"Invalid password for user: {user_data.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    logging.info(f"Successful login for user: {user_data.username}")
    access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"]
        }
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# User management routes (admin only)
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create users")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user_dict = user_data.dict()
    user_dict["password_hash"] = get_password_hash(user_dict.pop("password"))
    user_dict["id"] = str(uuid.uuid4())
    user_dict["created_at"] = get_la_time()
    
    await db.users.insert_one(user_dict)
    return User(**user_dict)

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view users")
    
    users = await db.users.find().to_list(1000)
    return [User(**user) for user in users]

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete users")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Client routes
@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete clients")
    
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted successfully"}

@api_router.post("/clients/import-excel")
async def import_clients_excel(employee_id: str = Form(None), file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can import clients")
    
    try:
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
        
        # Assuming Excel has columns: 'Name' and 'Address'
        clients_data = []
        for _, row in df.iterrows():
            client_data = {
                "id": str(uuid.uuid4()),
                "name": str(row['Name']) if 'Name' in row else str(row['name']),
                "address": str(row['Address']) if 'Address' in row else str(row['address']),
                "employee_id": employee_id,  # Assign to specific employee
                "created_at": get_la_time()
            }
            clients_data.append(client_data)
        
        if clients_data:
            await db.clients.insert_many(clients_data)
        
        return {"message": f"Successfully imported {len(clients_data)} clients"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error importing Excel file: {str(e)}")

@api_router.get("/clients", response_model=List[Client])
async def get_clients(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        # Admin sees all clients
        clients = await db.clients.find().sort("name", 1).to_list(1000)
    else:
        # Employee sees only their assigned clients
        clients = await db.clients.find({"employee_id": current_user.id}).sort("name", 1).to_list(1000)
    
    return [Client(**client) for client in clients]

@api_router.get("/clients/all", response_model=List[Client])
async def get_all_clients(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can access all clients")
    
    clients = await db.clients.find().sort("name", 1).to_list(1000)
    return [Client(**client) for client in clients]

@api_router.post("/clients", response_model=Client)
async def create_client(client_data: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create clients")
    
    client_dict = {
        "id": str(uuid.uuid4()),
        "name": client_data["name"],
        "address": client_data["address"],
        "employee_id": client_data.get("employee_id"),
        "created_at": get_la_time()
    }
    
    await db.clients.insert_one(client_dict)
    return Client(**client_dict)

# Service report routes
@api_router.post("/reports", response_model=ServiceReport)
async def create_service_report(report_data: ServiceReportCreate, current_user: User = Depends(get_current_user)):
    # Get client info
    client = await db.clients.find_one({"id": report_data.client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    report_dict = report_data.dict()
    report_dict["id"] = str(uuid.uuid4())
    report_dict["client_name"] = client["name"]
    report_dict["client_address"] = client["address"]
    report_dict["employee_id"] = current_user.id
    report_dict["employee_name"] = current_user.username
    report_dict["status"] = "reported"
    report_dict["admin_notes"] = ""
    report_dict["employee_notes"] = ""
    report_dict["created_at"] = get_la_time()
    report_dict["created_time"] = get_la_time_str()
    report_dict["request_date"] = get_la_time()
    report_dict["last_modified"] = get_la_time()
    report_dict["modification_history"] = []
    report_dict["total_cost"] = 0.0
    report_dict["parts_cost"] = 0.0
    report_dict["gross_profit"] = 0.0
    if "videos" not in report_dict:
        report_dict["videos"] = []
    
    await db.service_reports.insert_one(report_dict)
    return ServiceReport(**report_dict)

@api_router.get("/reports", response_model=List[ServiceReport])
async def get_service_reports(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        # Admin can see all reports
        reports = await db.service_reports.find().sort("created_at", -1).to_list(1000)
    else:
        # Employees can only see their own reports
        reports = await db.service_reports.find({"employee_id": current_user.id}).sort("created_at", -1).to_list(1000)
    
    return [ServiceReport(**report) for report in reports]

@api_router.put("/reports/{report_id}", response_model=ServiceReport)
async def update_service_report(report_id: str, update_data: ServiceReportUpdate, current_user: User = Depends(get_current_user)):
    # Get the existing report
    existing_report = await db.service_reports.find_one({"id": report_id})
    if not existing_report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check permissions - admin can edit all, employee can edit their own
    if current_user.role != "admin" and existing_report["employee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own reports")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    # Add modification tracking
    if update_dict:
        modification_entry = {
            "modified_by": current_user.username,
            "modified_by_role": current_user.role,
            "modified_at": get_la_time(),
            "modified_time": get_la_time_str(),
            "changes": list(update_dict.keys())
        }
        
        # Get current modification history or initialize empty list
        current_history = existing_report.get("modification_history", [])
        current_history.append(modification_entry)
        
        update_dict["modification_history"] = current_history
        update_dict["last_modified"] = get_la_time()
    
    result = await db.service_reports.update_one(
        {"id": report_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    updated_report = await db.service_reports.find_one({"id": report_id})
    return ServiceReport(**updated_report)

@api_router.delete("/reports/{report_id}")
async def delete_service_report(report_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete reports")
    
    result = await db.service_reports.delete_one({"id": report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"message": "Report deleted successfully"}

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
            raise HTTPException(status_code=404, detail="Frontend not built")
    
    @app.get("/")
    async def serve_root():
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        else:
            return {"message": "ROG Pool Service API - Frontend not available"}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)