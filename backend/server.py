from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the main app without a prefix
app = FastAPI(title="ROG Pool Service API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Global variables for MongoDB
mongodb_available = False
client = None
db = None

# Pydantic Models
class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class ServiceReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    title: str
    description: str
    status: str = "reported"  # reported, scheduled, in_progress, completed
    priority: str = "NORMAL"  # URGENT, SAME_WEEK, NEXT_WEEK, NORMAL
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

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
        
        # Create initial admin data if needed
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
        # Check if we have any clients
        client_count = await db.clients.count_documents({})
        if client_count == 0:
            # Create sample clients
            sample_clients = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "João Silva",
                    "address": "Rua das Flores, 123 - São Paulo",
                    "phone": "(11) 99999-9999",
                    "email": "joao.silva@email.com",
                    "created_at": datetime.now()
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Maria Santos",
                    "address": "Av. Paulista, 456 - São Paulo",
                    "phone": "(11) 88888-8888", 
                    "email": "maria.santos@email.com",
                    "created_at": datetime.now()
                }
            ]
            
            await db.clients.insert_many(sample_clients)
            logger.info(f"✅ Created {len(sample_clients)} sample clients")
            
            # Create sample service report
            sample_report = {
                "id": str(uuid.uuid4()),
                "client_id": sample_clients[0]["id"],
                "title": "Limpeza Completa da Piscina",
                "description": "Limpeza geral da piscina, verificação dos equipamentos e balanceamento químico",
                "status": "reported",
                "priority": "NORMAL",
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            await db.service_reports.insert_one(sample_report)
            logger.info("✅ Created sample service report")
            
    except Exception as e:
        logger.error(f"Error initializing default data: {e}")

@api_router.get("/")
def root():
    return {
        "message": "🏊‍♂️ ROG Pool Service - Sistema de Gestão de Piscinas", 
        "status": "success", 
        "version": "7.0",
        "platform": "emergent",
        "mongodb": "connected" if mongodb_available else "disconnected",
        "features": [
            "Client Management",
            "Service Reports", 
            "Photo Upload Support",
            "Status Tracking",
            "Sample Data Included"
        ]
    }

@api_router.get("/health")
def health():
    return {
        "status": "healthy", 
        "service": "rog-pool-service",
        "version": "7.0",
        "port": os.environ.get("PORT", "8001"),
        "platform": "emergent",
        "mongodb": "connected" if mongodb_available else "disconnected"
    }

# Client endpoints
@api_router.get("/clients", response_model=List[Client])
async def get_clients():
    if not mongodb_available:
        return []
    
    try:
        clients = await db.clients.find().to_list(1000)
        return [Client(**client) for client in clients]
    except Exception as e:
        logger.error(f"Error fetching clients: {e}")
        return []

@api_router.post("/clients", response_model=Client)
async def create_client(client: Client):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        await db.clients.insert_one(client.dict())
        return client
    except Exception as e:
        logger.error(f"Error creating client: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating client: {e}")

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        client = await db.clients.find_one({"id": client_id})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return Client(**client)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching client: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching client: {e}")

# Service Report endpoints
@api_router.get("/reports", response_model=List[ServiceReport])
async def get_reports():
    if not mongodb_available:
        return []
    
    try:
        reports = await db.service_reports.find().sort("created_at", -1).to_list(1000)
        return [ServiceReport(**report) for report in reports]
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        return []

@api_router.post("/reports", response_model=ServiceReport)
async def create_report(report: ServiceReport):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        await db.service_reports.insert_one(report.dict())
        return report
    except Exception as e:
        logger.error(f"Error creating report: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating report: {e}")

@api_router.get("/reports/{report_id}", response_model=ServiceReport)
async def get_report(report_id: str):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        report = await db.service_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return ServiceReport(**report)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching report: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching report: {e}")

@api_router.put("/reports/{report_id}", response_model=ServiceReport)
async def update_report(report_id: str, updated_report: ServiceReport):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Update the timestamp
        updated_report.updated_at = datetime.now()
        
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
