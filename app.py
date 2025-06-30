from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
import uvicorn
import os
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
import uuid
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ROG Pool Service API")

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
        from motor.motor_asyncio import AsyncIOMotorClient
        
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
    if not mongodb_available or not db:
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

@app.get("/")
def root():
    return {
        "message": "🏊‍♂️ ROG Pool Service - Sistema de Gestão de Piscinas", 
        "status": "success", 
        "version": "3.0",
        "platform": "render",
        "mongodb": "connected" if mongodb_available else "disconnected",
        "features": [
            "Client Management",
            "Service Reports", 
            "Photo Upload Support",
            "Status Tracking",
            "Sample Data Included"
        ]
    }

@app.get("/health")
def health():
    return {
        "status": "healthy", 
        "service": "rog-pool-service",
        "version": "3.0",
        "port": os.environ.get("PORT", "8000"),
        "platform": "render",
        "database": "connected" if mongodb_available else "disconnected",
        "mongodb_available": mongodb_available
    }

@app.get("/api/")
def api_root():
    endpoints = ["/", "/health", "/api/"]
    if mongodb_available:
        endpoints.extend(["/api/clients", "/api/reports", "/api/init-data"])
    
    return {
        "message": "ROG Pool Service API v3.0",
        "platform": "render", 
        "database": "connected" if mongodb_available else "disconnected",
        "endpoints": endpoints
    }

# MongoDB Endpoints
@app.get("/api/clients")
async def get_clients():
    if not mongodb_available:
        return {"message": "Database not available", "clients": []}
    
    try:
        clients = []
        async for client in db.clients.find():
            client['_id'] = str(client['_id'])
            clients.append(client)
        return {"clients": clients, "count": len(clients), "status": "success"}
    except Exception as e:
        logger.error(f"Error fetching clients: {e}")
        return {"error": str(e), "clients": []}

@app.post("/api/clients")
async def create_client(client: Client):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        client_dict = client.dict()
        await db.clients.insert_one(client_dict)
        logger.info(f"Client created: {client.name}")
        return {"message": "Client created successfully", "client": client_dict}
    except Exception as e:
        logger.error(f"Error creating client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports")
async def get_reports():
    if not mongodb_available:
        return {"message": "Database not available", "reports": []}
    
    try:
        reports = []
        async for report in db.service_reports.find():
            report['_id'] = str(report['_id'])
            reports.append(report)
        return {"reports": reports, "count": len(reports), "status": "success"}
    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        return {"error": str(e), "reports": []}

@app.post("/api/reports")
async def create_report(report: ServiceReport):
    if not mongodb_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        report_dict = report.dict()
        await db.service_reports.insert_one(report_dict)
        logger.info(f"Service report created: {report.title}")
        return {"message": "Service report created successfully", "report": report_dict}
    except Exception as e:
        logger.error(f"Error creating report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/init-data")
async def reinitialize_data():
    if not mongodb_available:
        return {"error": "Database not available"}
    
    try:
        await initialize_default_data()
        return {"message": "Sample data reinitialized successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/html", response_class=HTMLResponse)
def html_interface():
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>ROG Pool Service - Sistema de Gestão</title>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
            .container {{ max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            h1 {{ color: #2c3e50; text-align: center; }}
            .status {{ padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }}
            .connected {{ background: #d4edda; color: #155724; }}
            .disconnected {{ background: #f8d7da; color: #721c24; }}
            .endpoint {{ background: #e3f2fd; padding: 10px; margin: 5px 0; border-radius: 5px; }}
            .endpoint a {{ text-decoration: none; color: #1976d2; font-weight: bold; }}
            .endpoint a:hover {{ color: #0d47a1; }}
            button {{ background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }}
            button:hover {{ background: #0056b3; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏊‍♂️ ROG Pool Service</h1>
            <h2>Sistema de Gestão de Piscinas v3.0</h2>
            
            <div class="status {'connected' if mongodb_available else 'disconnected'}">
                <h3>🗄️ Status MongoDB: {'✅ CONECTADO' if mongodb_available else '❌ DESCONECTADO'}</h3>
                <p>Plataforma: <strong>Render</strong> | Versão: <strong>3.0</strong></p>
            </div>
            
            <h3>🔗 API Endpoints:</h3>
            <div class="endpoint">
                <a href="/">🏠 Homepage</a> - Informações do sistema
            </div>
            <div class="endpoint">
                <a href="/health">🏥 Health Check</a> - Status detalhado
            </div>
            <div class="endpoint">
                <a href="/api/">🔗 API Root</a> - Informações da API
            </div>
            
            {f'''
            <h3>🗄️ MongoDB Endpoints:</h3>
            <div class="endpoint">
                <a href="/api/clients">👥 Visualizar Clientes</a> - Lista todos os clientes
            </div>
            <div class="endpoint">
                <a href="/api/reports">📋 Visualizar Relatórios</a> - Lista relatórios de serviço
            </div>
            <div class="endpoint">
                <button onclick="initData()">🌱 Reinicializar Dados</button> - Criar dados de exemplo
            </div>
            ''' if mongodb_available else '<p>❌ Endpoints MongoDB não disponíveis</p>'}
            
            <h3>📋 Funcionalidades do Sistema:</h3>
            <ul>
                <li>✅ Gestão de Clientes</li>
                <li>✅ Relatórios de Serviço</li>
                <li>✅ Controle de Status</li>
                <li>✅ Sistema de Prioridades</li>
                <li>✅ Dados de Exemplo</li>
                <li>⏳ Upload de Fotos (próxima versão)</li>
                <li>⏳ Sistema de Autenticação (próxima versão)</li>
            </ul>
        </div>
        
        <script>
            function initData() {{
                fetch('/api/init-data', {{method: 'POST'}})
                    .then(response => response.json())
                    .then(data => {{
                        alert('Resultado:\\n' + JSON.stringify(data, null, 2));
                        window.location.reload();
                    }})
                    .catch(error => alert('Erro: ' + error));
            }}
        </script>
    </body>
    </html>
    """

# Start server
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"🚀 Starting ROG Pool Service on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)

# Auto-start in production
try:
    port = int(os.environ.get("PORT", 8000))
    if port != 8000:
        logger.info(f"🚀 Auto-starting on Render port {port}")
        uvicorn.run(app, host="0.0.0.0", port=port)
except:
    pass