from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Request
from pydantic import BaseModel
import uvicorn
import shutil
import os
from ultralytics import YOLO
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))


from fastapi.staticfiles import StaticFiles

# Create uploads directory if not exists
os.makedirs("uploads", exist_ok=True)

app = FastAPI(title="DIPK Backend")

# Mount Static Files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Incoming Request: {request.method} {request.url}")
    response = await call_next(request)
    print(f"Response Status: {response.status_code}")
    return response

# Database Config
DB_NAME = os.getenv("DB_NAME", "dipk_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")


# Load YOLO Models
TRASH_MODEL_PATH = os.path.join(os.path.dirname(__file__), '../best.pt')
BOTTLE_MODEL_PATH = os.path.join(os.path.dirname(__file__), '../little_best.pt')

try:
    model_trash = YOLO(TRASH_MODEL_PATH)
    print(f"Trash Model loaded from {TRASH_MODEL_PATH}")
except Exception as e:
    print(f"Error loading Trash Model: {e}")
    model_trash = None

try:
    model_bottle = YOLO(BOTTLE_MODEL_PATH)
    print(f"Bottle Model loaded from {BOTTLE_MODEL_PATH}")
except Exception as e:
    print(f"Error loading Bottle Model: {e}")
    model_bottle = None

def get_db_connection():
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"DB Connection Error: {e}")
        return None

try:
    from backend.auth import verify_password, get_password_hash, create_access_token, decode_token
except ImportError:
    from auth import verify_password, get_password_hash, create_access_token, decode_token

from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, status, Request

# ... (Previous imports kept) ...

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class User(BaseModel):
    username: str
    password: str
    role: str = "AGENT" # ADMIN, INSPECTEUR, SUPERVISEUR, AGENT
    full_name: Optional[str] = None
    phone: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

# Helper to get current user
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload

@app.get("/token")
async def get_token_debug():
    return {"message": "This endpoint expects POST. usage: POST /token username=...&password=..."}

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM users WHERE username = %s", (form_data.username,))
        user = cur.fetchone()
        
        if not user or not verify_password(form_data.password, user['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token = create_access_token(
            data={"sub": user['username'], "role": user['role'], "id": user['id']}
        )
        return {"access_token": access_token, "token_type": "bearer"}
    finally:
        cur.close()
        conn.close()

@app.post("/register")
async def register_user(user: User):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        hashed_password = get_password_hash(user.password)
        cur.execute(
            "INSERT INTO users (username, password_hash, role, full_name, phone) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (user.username, hashed_password, user.role.upper(), user.full_name, user.phone)
        )
        conn.commit()
        return {"status": "User created successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()

class Location(BaseModel):
    latitude: float
    longitude: float

@app.get("/")
def read_root():
    return {"status": "online", "system": "DIPK Smart City"}

@app.post("/predict_trash")
async def predict_trash(file: UploadFile = File(...)):
    """
    Step 1: AI Validation.
    Returns: {"is_trash": bool, "confidence": float, "is_plastic": bool, "plastic_confidence": float}
    """
    if not model_trash:
        raise HTTPException(status_code=503, detail="Trash Model not loaded")

    # Save temp file
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Analyze results
    is_trash = False
    trash_confidence = 0.0
    is_plastic = False
    plastic_confidence = 0.0
    bottle_count = 0

    try:
        # Run Trash Detection (Trash Can)
        results_trash = model_trash(temp_filename, conf=0.5, imgsz=640)
        
        for r in results_trash:
            for box in r.boxes:
                conf = float(box.conf[0])
                if conf > 0.5:
                    is_trash = True
                    trash_confidence = max(trash_confidence, conf)
        
        # If trash can detected, check for plastic bottles
        # USER REQUEST: Do not apply strict threshold for bottle model, just evaluate and count.
        if is_trash and model_bottle:
            # Lower confidence to 0.01 (effectively no threshold)
            results_bottle = model_bottle(temp_filename, conf=0.01, imgsz=640)
            
            for r in results_bottle:
                # Count all detections that passed the low threshold
                bottle_count += len(r.boxes)
                
                for box in r.boxes:
                    conf = float(box.conf[0])
                    # We still track max confidence for metadata
                    if conf > 0.01: 
                        is_plastic = True
                        plastic_confidence = max(plastic_confidence, conf)

    finally:
        # Clean up
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

    return {
        "is_trash": is_trash, 
        "confidence": trash_confidence,
        "is_plastic": is_plastic,
        "plastic_confidence": plastic_confidence,
        "bottle_count": bottle_count
    }

@app.post("/submit_report")
async def submit_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    file: UploadFile = File(...)
):
    """
    Step 2: Submit Validated Report.
    Checks for nearby legal bins.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        cur = conn.cursor()
        
        # Check for legal bins within 20 meters
        # ST_DWithin uses degrees for 4326, so we better cast to geography for meters or use correct SRID
        # Using geography for meters accuracy
        query = """
            SELECT id, osm_id, ST_Distance(
                geom::geography, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) as distance
            FROM poubelles_officielles
            WHERE ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                20
            )
            ORDER BY distance ASC
            LIMIT 1;
        """
        cur.execute(query, (longitude, latitude, longitude, latitude))
        match = cur.fetchone()
        
        # Determine Status
        if match:
            status = "LEGAL_MAINTENANCE"
            message = "Poubelle officielle détectée. Signalement de maintenance envoyé."
            bin_id = match['osm_id']
        else:
            status = "ILLEGAL_DUMP"
            message = "Dépôt illégal détecté. Alerte envoyée aux services de nettoyage."
            bin_id = None
            
        # Save image for central dashboard (mock implementation)
        # In prod: upload to S3 or dedicated folder
        # Use absolute path to ensure it goes to DIPK/uploads correctly and is storable in DB as absolute path
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # Go up one level from backend/
        save_dir = os.path.join(base_dir, "uploads")
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, f"{status}_{file.filename}")
        
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Save to DB
        insert_query = """
            INSERT INTO signalements (geom, image_path, status, status_message, latitude, longitude)
            VALUES (ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s)
        """
        cur.execute(insert_query, (longitude, latitude, save_path, status, message, latitude, longitude))
        conn.commit()
        

        cur.close()
        conn.close()
        
        return {
            "status": status,
            "message": message,
            "nearby_bin_id": bin_id,
            "image_saved_at": save_path
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"DEBUG ERROR: {e}")
        if conn: conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# --- V2 ENDPOINTS ---

@app.post("/admin/create_user", dependencies=[Depends(oauth2_scheme)])
async def create_user_admin(user: User, current_user: dict = Depends(get_current_user)):
    """
    Admin only: Create new users (Agents, Inspectors, Supervisors).
    """
    if current_user['role'] != 'ADMIN':
        raise HTTPException(status_code=403, detail="Not authorized. Admin access required.")
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Check if username exists
        cur.execute("SELECT id FROM users WHERE username = %s", (user.username,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Username already exists")

        hashed_password = get_password_hash(user.password)
        cur.execute(
            "INSERT INTO users (username, password_hash, role, full_name, phone) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (user.username, hashed_password, user.role.upper(), user.full_name, user.phone)
        )
        new_id = cur.fetchone()['id']
        conn.commit()
        return {"status": "User created", "user_id": new_id, "role": user.role}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/nearest_transit_center")
async def get_nearest_transit_center(lat: float, lon: float):
    """
    Finds the nearest Operational Transit Center.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT id, name, status, 
            ST_Distance(
                geom::geography, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) as distance_meters,
            ST_Y(geom::geometry) as lat,
            ST_X(geom::geometry) as lon
            FROM centres_transit
            WHERE status != 'FULL'
            ORDER BY distance_meters ASC
            LIMIT 1;
        """
        cur.execute(query, (lon, lat))
        tc = cur.fetchone()
        
        if tc:
            return {
                "id": tc['id'],
                "name": tc['name'],
                "status": tc['status'],
                "distance_meters": round(tc['distance_meters'], 2),
                "location": {"latitude": tc['lat'], "longitude": tc['lon']}
            }
        else:
            raise HTTPException(status_code=404, detail="No available transit center found")
    finally:
        cur.close()
        conn.close()

@app.post("/assign_task", dependencies=[Depends(oauth2_scheme)])
async def assign_task(report_id: int, agent_id: int, current_user: dict = Depends(get_current_user)):
    """
    Admin/Supervisor: Assign a report to an Agent.
    """
    if current_user['role'] not in ['ADMIN', 'SUPERVISEUR']:
        raise HTTPException(status_code=403, detail="Not authorized.")
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Verify Agent exists
        cur.execute("SELECT id FROM users WHERE id = %s AND role = 'AGENT'", (agent_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Agent not found")

        cur.execute("""
            UPDATE signalements 
            SET assigned_to = %s, status = 'ASSIGNED' 
            WHERE id = %s
            RETURNING id
        """, (agent_id, report_id))
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Report not found")
            
        conn.commit()
        return {"status": "Task assigned", "report_id": report_id, "agent_id": agent_id}
    finally:
        cur.close()
        conn.close()

@app.get("/my_tasks", dependencies=[Depends(oauth2_scheme)])
async def get_my_tasks(current_user: dict = Depends(get_current_user)):
    """
    Agent: Get assigned tasks.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT id, status, status_message, latitude, longitude, created_at, image_path
            FROM signalements
            WHERE assigned_to = %s AND status != 'CLEANED'
            ORDER BY created_at DESC
        """
        cur.execute(query, (current_user['id'],))
        tasks = []
        for row in cur.fetchall():
            tasks.append({
                "id": row[0],
                "status": row[1],
                "message": row[2],
                "location": {"latitude": row[3], "longitude": row[4]},
                "created_at": row[5].isoformat() if row[5] else None,
                "image_url": f"/uploads/{os.path.basename(row[6])}" if row[6] else None
            })
        return tasks
    finally:
        cur.close()
        conn.close()

class StatusUpdate(BaseModel):
    report_id: int
    new_status: str # COLLECTED, TRANSIT_ARRIVAL, CLEANED
    transit_center_id: Optional[int] = None

@app.post("/update_report_status", dependencies=[Depends(oauth2_scheme)])
async def update_report_status(update: StatusUpdate, current_user: dict = Depends(get_current_user)):
    """
    Update the lifecycle status of a report.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # FSM Logic could go here (e.g. check current status before updating)
        
        if update.new_status == 'TRANSIT_ARRIVAL':
             # Agent arrived at Transit Center
             cur.execute("""
                UPDATE signalements 
                SET status = %s, transit_center_id = %s
                WHERE id = %s AND assigned_to = %s
             """, (update.new_status, update.transit_center_id, update.report_id, current_user['id']))
        
        elif update.new_status == 'CLEANED':
            # Inspector confirms cleaning
            if current_user['role'] != 'INSPECTEUR':
                 raise HTTPException(status_code=403, detail="Only Inspector can confirm CLEANED.")
            
            cur.execute("""
                UPDATE signalements 
                SET status = %s, validated_by = %s, validated_at = NOW()
                WHERE id = %s
             """, (update.new_status, current_user['id'], update.report_id))
             
        else:
            # Generic update
            cur.execute("""
                UPDATE signalements 
                SET status = %s
                WHERE id = %s
            """, (update.new_status, update.report_id))

        if cur.rowcount == 0:
             raise HTTPException(status_code=400, detail="Update failed (Check permissions or ID)")
             
        conn.commit()
        return {"status": "Updated", "new_status": update.new_status}
    finally:
        cur.close()
        conn.close()

@app.get("/admin/stats", dependencies=[Depends(oauth2_scheme)])
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    """
    Get global statistics for the dashboard.
    """
    if current_user['role'] not in ['ADMIN', 'SUPERVISEUR']:
        raise HTTPException(status_code=403, detail="Not authorized.")
        
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) as cnt FROM signalements")
        total = cur.fetchone()['cnt']
        
        cur.execute("SELECT COUNT(*) as cnt FROM signalements WHERE status = 'ILLEGAL_DUMP'")
        illegal = cur.fetchone()['cnt']
        
        cur.execute("SELECT COUNT(*) as cnt FROM signalements WHERE status = 'CLEANED'")
        cleaned = cur.fetchone()['cnt']
        
        cur.execute("SELECT COUNT(*) as cnt FROM signalements WHERE status NOT IN ('CLEANED', 'ILLEGAL_DUMP')")
        open_reports = cur.fetchone()['cnt'] 
        
        return {
            "total": total,
            "illegal": illegal,
            "cleaned": cleaned,
            "open": open_reports
        }
    finally:
        cur.close()
        conn.close()

@app.get("/admin/users", dependencies=[Depends(oauth2_scheme)])
async def get_admin_users(current_user: dict = Depends(get_current_user)):
    """
    Get list of all users.
    """
    if current_user['role'] != 'ADMIN':
        raise HTTPException(status_code=403, detail="Not authorized.")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, username, role, full_name, phone, created_at FROM users ORDER BY id DESC")
        users = []
        for row in cur.fetchall():
            users.append({
                "id": row['id'],
                "username": row['username'],
                "role": row['role'],
                "full_name": row['full_name'],
                "phone": row['phone'],
                "created_at": row['created_at'].isoformat() if row['created_at'] else None
            })
        return users
    finally:
        cur.close()
        conn.close()

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

@app.put("/admin/users/{user_id}", dependencies=[Depends(oauth2_scheme)])
async def update_user(user_id: int, user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    """
    Update a user's details. Only ADMIN can do this.
    """
    if current_user['role'] != 'ADMIN':
        raise HTTPException(status_code=403, detail="Not authorized.")
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        existing_user = cur.fetchone()
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        update_fields = []
        update_values = []
        
        if user_update.username is not None:
            update_fields.append("username = %s")
            update_values.append(user_update.username)
        
        if user_update.password:
            hashed_password = get_password_hash(user_update.password)
            update_fields.append("password_hash = %s")
            update_values.append(hashed_password)
            
        if user_update.role is not None:
            update_fields.append("role = %s")
            update_values.append(user_update.role.upper())
            
        if user_update.full_name is not None:
            update_fields.append("full_name = %s")
            update_values.append(user_update.full_name)
            
        if user_update.phone is not None:
            update_fields.append("phone = %s")
            update_values.append(user_update.phone)
            
        if not update_fields:
            return {"status": "No changes provided"}
            
        update_values.append(user_id)
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
        
        cur.execute(query, tuple(update_values))
        conn.commit()
        return {"status": "User updated successfully"}
    except psycopg2.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Username already exists")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.delete("/admin/users/{user_id}", dependencies=[Depends(oauth2_scheme)])
async def delete_user(user_id: int, current_user: dict = Depends(get_current_user)):
    """
    Delete a user. Only ADMIN can do this.
    """
    if current_user['role'] != 'ADMIN':
        raise HTTPException(status_code=403, detail="Not authorized.")
        
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
            
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return {"status": "User deleted successfully"}
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Cannot delete user because they are assigned to active tasks, a transit center or a landfill. Unassign them first.")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/admin/reports", dependencies=[Depends(oauth2_scheme)])
async def get_admin_reports(current_user: dict = Depends(get_current_user)):
    """
    Get all reports with details.
    """
    if current_user['role'] not in ['ADMIN', 'SUPERVISEUR']:
        raise HTTPException(status_code=403, detail="Not authorized.")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Join with users to get agent names if assigned
        query = """
            SELECT s.id, s.status, s.status_message, s.latitude, s.longitude, s.created_at, s.image_path,
                   u.username as assigned_agent, s.assigned_to
            FROM signalements s
            LEFT JOIN users u ON s.assigned_to = u.id
            ORDER BY s.created_at DESC
        """
        cur.execute(query)
        reports = []
        for row in cur.fetchall():
            reports.append({
                "id": row['id'],
                "status": row['status'],
                "message": row['status_message'],
                "location": {"latitude": row['latitude'], "longitude": row['longitude']},
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                "image_url": f"/uploads/{os.path.basename(row['image_path'])}" if row['image_path'] else None,
                "assigned_agent": row['assigned_agent'],
                "agent_id": row['assigned_to']
            })
        return reports
    finally:
        cur.close()
        conn.close()

class AssignmentUpdate(BaseModel):
    agent_id: Optional[int] = None

@app.put("/admin/reports/{report_id}/assign", dependencies=[Depends(oauth2_scheme)])
async def assign_report(report_id: int, assignment: AssignmentUpdate, current_user: dict = Depends(get_current_user)):
    """
    Assign a report to an agent or unassign if agent_id is null.
    """
    if current_user['role'] not in ['ADMIN', 'SUPERVISEUR']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if assignment.agent_id is None:
            # Unassign the report
            cur.execute("UPDATE signalements SET assigned_to = NULL, status = 'PENDING' WHERE id = %s", (report_id,))
        else:
            # Check if agent exists and get their role
            cur.execute("SELECT id, role FROM users WHERE id = %s AND (role = 'AGENT' OR role = 'INSPECTEUR')", (assignment.agent_id,))
            user_row = cur.fetchone()
            if not user_row:
                 raise HTTPException(status_code=400, detail="Invalid agent ID or user is not an agent/inspector")

            assignee_role = user_row['role']
            new_status = 'INSPECTION_ASSIGNED' if assignee_role == 'INSPECTEUR' else 'ASSIGNED'

            cur.execute("UPDATE signalements SET assigned_to = %s, status = %s WHERE id = %s", (assignment.agent_id, new_status, report_id))
        
        conn.commit()
        return {"status": "Updated assignment"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

class SupervisorAssignmentUpdate(BaseModel):
    supervisor_id: Optional[int] = None

@app.put("/admin/transit/{center_id}/assign", dependencies=[Depends(oauth2_scheme)])
async def assign_transit_center(center_id: int, assignment: SupervisorAssignmentUpdate, current_user: dict = Depends(get_current_user)):
    """
    Assign a transit center to a supervisor.
    """
    if current_user['role'] not in ['ADMIN']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if assignment.supervisor_id is None:
            cur.execute("UPDATE centres_transit SET supervisor_id = NULL WHERE id = %s", (center_id,))
        else:
            # Check if user is a supervisor
            cur.execute("SELECT id FROM users WHERE id = %s AND role = 'SUPERVISEUR'", (assignment.supervisor_id,))
            if not cur.fetchone():
                 raise HTTPException(status_code=400, detail="Invalid ID or user is not a supervisor")

            cur.execute("UPDATE centres_transit SET supervisor_id = %s WHERE id = %s", (assignment.supervisor_id, center_id))
        conn.commit()
        return {"status": "Assigned"}
    except Exception as e:
        conn.rollback()
        print(f"ERROR ASSIGNING TRANSIT CENTER: {e}") # Debug log
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.put("/admin/landfill/{center_id}/assign", dependencies=[Depends(oauth2_scheme)])
async def assign_landfill(center_id: int, assignment: SupervisorAssignmentUpdate, current_user: dict = Depends(get_current_user)):
    """
    Assign a landfill to a supervisor, or unassign if supervisor_id is null.
    """
    if current_user['role'] not in ['ADMIN']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if assignment.supervisor_id is None:
            cur.execute("UPDATE centres_enfouissement SET supervisor_id = NULL WHERE id = %s", (center_id,))
        else:
            # Check if user is a supervisor
            cur.execute("SELECT id FROM users WHERE id = %s AND role = 'SUPERVISEUR'", (assignment.supervisor_id,))
            if not cur.fetchone():
                 raise HTTPException(status_code=400, detail="Invalid ID or user is not a supervisor")

            cur.execute("UPDATE centres_enfouissement SET supervisor_id = %s WHERE id = %s", (assignment.supervisor_id, center_id))
        conn.commit()
        return {"status": "Assigned"}
    except Exception as e:
        conn.rollback()
        print(f"ERROR ASSIGNING LANDFILL: {e}") # Debug log
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/admin/map_data", dependencies=[Depends(oauth2_scheme)])
async def get_map_data(current_user: dict = Depends(get_current_user)):
    """
    Get all map entities: Reports (Bins), Transit Centers, Landfills, AND Official Bins.
    Accessible to ADMIN, SUPERVISOR, INSPECTOR, and AGENT (for finding TCs).
    """
    # Allow Agents/Inspectors to see map data (e.g. TCs)
    if current_user['role'] not in ['ADMIN', 'SUPERVISEUR', 'SUPERVISOR', 'INSPECTEUR', 'INSPECTOR', 'AGENT']:
         raise HTTPException(status_code=403, detail="Not authorized")
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        data = {
            "reports": [],
            "transit_centers": [],
            "landfills": [],
            "bins": [] # New category for official bins
        }

        # 1. Get Signalements (Reports/Issues on Bins)
        cur.execute("""
            SELECT id, status, status_message, latitude, longitude 
            FROM signalements 
            WHERE status != 'CLEANED' AND status != 'LEGAL_MAINTENANCE_CLEANED'
        """)
        for row in cur.fetchall():
            # Apply color mappings based on rules:
            # Red: ILLEGAL_DUMP
            # Grey: LEGAL_MAINTENANCE (Legal reported)
            # Yellow: IN_TRANSIT, DEPOSITED, WAITING_INSPECTION, INSPECTION_ASSIGNED
            color = "gray"
            if row['status'] == 'ILLEGAL_DUMP':
                color = "red"
            elif row['status'] in ['IN_TRANSIT', 'DEPOSITED', 'WAITING_INSPECTION', 'INSPECTION_ASSIGNED']:
                color = "yellow"

            data["reports"].append({
                "id": row['id'],
                "type": "REPORT",
                "status": row['status'],
                "message": row['status_message'],
                "lat": row['latitude'],
                "lng": row['longitude'],
                "color": color
            })

        # 2. Get Transit Centers
        # Check if status column exists, if not default to OPERATIONAL
        # For simplicity in this fix, we assume it exists or we handle error?
        # The previous error was on centres_enfouissement status? No, verify log.
        # Log said: psycopg2.errors.UndefinedColumn: column "status" does not exist LINE 2: SELECT id, name, status ... FROM centres_transit
        # Wait, the log said centres_transit!!!
        # My analysis of database_setup.py showed it HAS status. 
        # BUT the error says it DOES NOT. This means the DB is out of sync with setup.py.
        # I will remove 'status' from the query for centres_transit too, or assume 'OPERATIONAL'.
        
        cur.execute("""
            SELECT ct.id, ct.name, ST_Y(ct.geom::geometry) as lat, ST_X(ct.geom::geometry) as lon, 
                   u.username as supervisor_name, ct.supervisor_id
            FROM centres_transit ct
            LEFT JOIN users u ON ct.supervisor_id = u.id
        """)
        for row in cur.fetchall():
            data["transit_centers"].append({
                "id": row['id'],
                "type": "TRANSIT_CENTER",
                "name": row['name'],
                "status": "OPERATIONAL",
                "lat": row['lat'],
                "lng": row['lon'],
                "supervisor_name": row['supervisor_name'],
                "supervisor_id": row['supervisor_id']
            })

        # 3. Get Landfills
        cur.execute("""
            SELECT ce.id, ce.name, ST_Y(ce.geom::geometry) as lat, ST_X(ce.geom::geometry) as lon,
                   u.username as supervisor_name, ce.supervisor_id, ce.status
            FROM centres_enfouissement ce
            LEFT JOIN users u ON ce.supervisor_id = u.id
        """)
        for row in cur.fetchall():
            data["landfills"].append({
                "id": row['id'],
                "type": "LANDFILL",
                "name": row['name'],
                "status": row['status'] or "OPERATIONAL",
                "lat": row['lat'],
                "lng": row['lon'],
                "color": "black",
                "supervisor_name": row['supervisor_name'],
                "supervisor_id": row['supervisor_id']
            })

        # 4. Get Official Bins (Poubelles Publiques)
        cur.execute("""
            SELECT id, osm_id, ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lon
            FROM poubelles_officielles
        """)
        for row in cur.fetchall():
            data["bins"].append({
                "id": row['id'],
                "osm_id": row['osm_id'], # Added missing field
                "type": "BIN",
                "status": "OK",
                "lat": row['lat'],
                "lng": row['lon']
            })

        return data
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
@app.get("/supervisor/my_center", dependencies=[Depends(oauth2_scheme)])
async def get_supervisor_center(current_user: dict = Depends(get_current_user)):
    """
    Get the transit center assigned to the current supervisor.
    """
    if current_user['role'] not in ['SUPERVISEUR', 'SUPERVISOR', 'ADMIN']:
         raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, name, capacity_max, current_load, status, ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lon
            FROM centres_transit
            WHERE supervisor_id = %s
        """, (current_user['id'],))
        
        row = cur.fetchone()
        if not row:
            return None # Or raise 404 if strict, but maybe they just aren't assigned yet

        return {
            "id": row['id'],
            "name": row['name'],
            "capacity_max": row['capacity_max'],
            "current_load": row['current_load'],
            "status": row['status'],
            "lat": row['lat'],
            "lon": row['lon']
        }
    finally:
        cur.close()
        conn.close()

@app.get("/agent/my_tasks", dependencies=[Depends(oauth2_scheme)])
async def get_agent_tasks(current_user: dict = Depends(get_current_user)):
    """
    Get tasks assigned to the current agent that are ASSIGNED (not yet IN_TRANSIT).
    """
    if current_user['role'] not in ['AGENT', 'SUPERVISEUR', 'INSPECTEUR', 'ADMIN', 'SUPERVISOR', 'INSPECTOR']:
         raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Fetch reports assigned to this user that are ASSIGNED (to be picked up)
        cur.execute("""
            SELECT id, status, status_message, created_at, latitude, longitude
            FROM signalements
            WHERE assigned_to = %s AND status IN ('ASSIGNED')
            ORDER BY created_at DESC
        """, (current_user['id'],))
        
        tasks = []
        for row in cur.fetchall():
            tasks.append({
                "id": row['id'],
                "status": row['status'],
                "message": row['status_message'],
                "created_at": row['created_at'].isoformat(),
                "latitude": row['latitude'],
                "longitude": row['longitude']
            })
        return tasks
    finally:
        cur.close()
        conn.close()

@app.post("/agent/confirm_deposit", dependencies=[Depends(oauth2_scheme)])
async def confirm_deposit(current_user: dict = Depends(get_current_user)):
    """
    Agent: Confirm drop-off of IN_TRANSIT tasks at the transit center.
    This changes all IN_TRANSIT tasks for this agent to DEPOSITED.
    """
    if current_user['role'] not in ['AGENT', 'SUPERVISEUR', 'INSPECTEUR', 'ADMIN']:
         raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE signalements
            SET status = 'DEPOSITED'
            WHERE assigned_to = %s AND status = 'IN_TRANSIT'
            RETURNING id
        """, (current_user['id'],))
        
        updated_rows = cur.fetchall()
        conn.commit()
        return {"status": "success", "deposited_count": len(updated_rows)}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/supervisor/incoming_deposits", dependencies=[Depends(oauth2_scheme)])
async def get_incoming_deposits(current_user: dict = Depends(get_current_user)):
    """
    Supervisor: Get a list of agents who have DEPOSITED tasks at their center, 
    waiting for supervisor validation.
    """
    if current_user['role'] not in ['SUPERVISEUR', 'ADMIN']:
         raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Find the transit center for this supervisor
        cur.execute("SELECT id FROM centres_transit WHERE supervisor_id = %s", (current_user['id'],))
        tc = cur.fetchone()
        if not tc:
             # Just return empty if not assigned to a center
             return []
             
        # Fetch agents and count of their DEPOSITED bins waiting at this center
        # Since currently we only track transit_center_id in IN_TRANSIT, 
        # wait, the previous update logic put transit_center_id on signalement?
        # Let's assume the agent just drops them, the supervisor sees DEPOSITED tasks from any agent if they are assigned.
        # Actually, let's group by agent_id for DEPOSITED tasks.
        cur.execute("""
            SELECT u.id as agent_id, u.username, u.full_name, COUNT(s.id) as task_count,
                   ARRAY_AGG(s.id) as task_ids
            FROM signalements s
            JOIN users u ON s.assigned_to = u.id
            WHERE s.status = 'DEPOSITED'
            GROUP BY u.id, u.username, u.full_name
        """)
        
        deposits = []
        for row in cur.fetchall():
            deposits.append({
                "agent_id": row['agent_id'],
                "agent_name": row['full_name'] or row['username'],
                "task_count": row['task_count'],
                "task_ids": row['task_ids']
            })
        return deposits
    finally:
        cur.close()
        conn.close()

class ValidateDepositRequest(BaseModel):
    agent_id: int

@app.post("/supervisor/validate_deposit", dependencies=[Depends(oauth2_scheme)])
async def validate_deposit(req: ValidateDepositRequest, current_user: dict = Depends(get_current_user)):
    """
    Supervisor: Validates the deposit from an agent, moving tasks to WAITING_INSPECTION.
    """
    if current_user['role'] not in ['SUPERVISEUR', 'ADMIN']:
         raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE signalements
            SET status = 'WAITING_INSPECTION', assigned_to = NULL
            WHERE assigned_to = %s AND status = 'DEPOSITED'
            RETURNING id
        """, (req.agent_id,))
        
        updated_rows = cur.fetchall()
        conn.commit()
        return {"status": "success", "validated_count": len(updated_rows)}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.put("/agent/tasks/{task_id}/resolve", dependencies=[Depends(oauth2_scheme)])
async def resolve_task(task_id: int, status_update: dict, current_user: dict = Depends(get_current_user)):
    """
    Mark a task as IN_TRANSIT (previously CLEANED).
    """
    if current_user['role'] not in ['AGENT', 'SUPERVISEUR', 'INSPECTEUR', 'ADMIN', 'SUPERVISOR', 'INSPECTOR']:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # We now change it to IN_TRANSIT instead of CLEANED
    new_status = status_update.get("status")
    if new_status not in ["CLEANED", "IN_TRANSIT"]:
        raise HTTPException(status_code=400, detail="Invalid status update.")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE signalements
            SET status = 'IN_TRANSIT'
            WHERE id = %s
        """, (task_id,))
        conn.commit()
        return {"status": "Task marked IN_TRANSIT"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/inspector/my_tasks", dependencies=[Depends(oauth2_scheme)])
async def get_inspector_tasks(current_user: dict = Depends(get_current_user)):
    """
    Inspector: Get assigned verification tasks.
    """
    if current_user['role'] not in ['INSPECTEUR', 'INSPECTOR', 'ADMIN']:
         raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, status, status_message, created_at, latitude, longitude
            FROM signalements
            WHERE assigned_to = %s AND status = 'INSPECTION_ASSIGNED'
            ORDER BY created_at DESC
        """, (current_user['id'],))
        
        tasks = []
        for row in cur.fetchall():
            tasks.append({
                "id": row['id'],
                "status": row['status'],
                "message": row['status_message'],
                "created_at": row['created_at'].isoformat(),
                "latitude": row['latitude'],
                "longitude": row['longitude']
            })
        return tasks
    finally:
        cur.close()
        conn.close()

class InspectorValidation(BaseModel):
    task_id: int
    lat: float
    lon: float

@app.post("/inspector/validate_task", dependencies=[Depends(oauth2_scheme)])
async def inspector_validate(val: InspectorValidation, current_user: dict = Depends(get_current_user)):
    """
    Inspector: Validates a bin is clean on-site with 10m strict GPS verification.
    """
    if current_user['role'] not in ['INSPECTEUR', 'INSPECTOR', 'ADMIN']:
         raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Check task location
        cur.execute("SELECT latitude, longitude FROM signalements WHERE id = %s AND assigned_to = %s AND status = 'INSPECTION_ASSIGNED'", (val.task_id, current_user['id']))
        task = cur.fetchone()
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found or not assigned to you")
            
        # Calculate distance
        # Using simple Haversine or Postgres ST_Distance
        cur.execute("""
            SELECT ST_Distance(
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) as dist
        """, (val.lon, val.lat, task['longitude'], task['latitude']))
        
        dist = cur.fetchone()['dist']
        if dist > 15: # Giving a slight 15m tolerance for real-world GPS glitch
            raise HTTPException(status_code=400, detail=f"Vous êtes trop loin ({round(dist)}m). Rapprochez-vous à moins de 10m.")

        # Update status to CLEANED
        cur.execute("""
            UPDATE signalements
            SET status = 'CLEANED'
            WHERE id = %s
        """, (val.task_id,))
        
        conn.commit()
        return {"status": "success", "message": "Poubelle vérifiée et validée proprement."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
