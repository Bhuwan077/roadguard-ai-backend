from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
from supabase import create_client
from dotenv import load_dotenv
import io, os, uuid
import gc
import torch
import httpx

torch.set_num_threads(1)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_ANON_KEY = "sb_publishable_vRniLHL0K84KEBR5fpqBKw_Uht4wKkB"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

STORAGE_BUCKET = "damage-photos"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
model = YOLO("models/YOLOv8_Small_RDD.pt")

@app.get("/")
def read_root():
    return {"status": "RoadGuard AI backend is running"}

@app.post("/detect")
async def detect_damage(file: UploadFile = File(...), latitude: float = 0.0, longitude: float = 0.0):
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))

    # Resize down before inference — cuts memory usage substantially on
    # Render's limited free-tier RAM
    max_dimension = 640
    image.thumbnail((max_dimension, max_dimension))

    img_width, img_height = image.size
    image_area = img_width * img_height

    with torch.no_grad():
        results = model(image)

    detections = []
    image_url = None

    for result in results:
        if len(result.boxes) == 0:
            continue

        # Only upload the image once per request, and only if something was found
        if image_url is None:
            file_name = f"{uuid.uuid4()}.jpg"
            supabase.storage.from_(STORAGE_BUCKET).upload(
                file_name,
                image_bytes,
                {"content-type": "image/jpeg"}
            )
            image_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(file_name)

        for box in result.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            class_name = model.names[cls_id]
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            box_area = (x2 - x1) * (y2 - y1)
            area_ratio = box_area / image_area

            if area_ratio > 0.08:
                severity = "Severe"
            elif area_ratio > 0.02:
                severity = "Moderate"
            else:
                severity = "Minor"

            detection = {
                "damage_type": class_name,
                "confidence": round(conf, 2),
                "severity": severity,
                "latitude": latitude,
                "longitude": longitude,
                "image_url": image_url
            }

            supabase.table("reports").insert(detection).execute()
            detections.append(detection)

    del results, image, image_bytes
    gc.collect()

    return {"detections": detections}

@app.get("/reports")
def get_reports():
    response = supabase.table("reports").select("*").order("id", desc=True).execute()
    return response.data

@app.delete("/admin/reports/{report_id}")
async def admin_delete_report(report_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing login token")

    token = authorization.split(" ", 1)[1]

    # Verify the token directly with Supabase's Auth service (separate from
    # the data-layer outage affecting RLS checks)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY
            }
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired login session")

    # Token confirmed valid — delete using the backend's own admin access,
    # which bypasses RLS entirely
    result = supabase.table("reports").delete().eq("id", report_id).execute()
    return {"deleted": True, "data": result.data}