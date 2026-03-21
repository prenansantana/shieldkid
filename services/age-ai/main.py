"""
ShieldKid Age AI — Microservice for facial age estimation & KYC.

Uses InsightFace (buffalo_l model) with ONNX Runtime on CPU.

Endpoints:
  POST /analyze    — Estimate age from image
  POST /compare    — Compare two faces (document vs selfie)
  POST /kyc        — Full KYC: document photo + selfie → match + age
  GET  /health     — Health check
"""

import logging
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from insightface.app import FaceAnalysis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("age-ai")

app = FastAPI(
    title="ShieldKid Age AI",
    description="Facial age estimation & KYC microservice",
    version="2.0.0",
)

face_app: FaceAnalysis | None = None


@app.on_event("startup")
async def load_model():
    global face_app
    logger.info("Loading InsightFace model (buffalo_l)...")
    start = time.time()

    face_app = FaceAnalysis(
        name="buffalo_l",
        providers=["CPUExecutionProvider"],
    )
    face_app.prepare(ctx_id=-1, det_size=(640, 640))

    elapsed = time.time() - start
    logger.info(f"Model loaded in {elapsed:.1f}s")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": face_app is not None,
    }


def decode_image(contents: bytes) -> np.ndarray:
    """Decode image bytes to OpenCV BGR array."""
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 10MB)")
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image format")
    return img


def extract_face_data(img: np.ndarray) -> list[dict]:
    """Run face analysis and return structured results."""
    if face_app is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    faces = face_app.get(img)
    results = []
    for face in faces:
        data = {
            "age": int(face.age),
            "gender": "M" if face.gender == 1 else "F",
            "bbox": [round(float(c), 1) for c in face.bbox],
            "confidence": round(float(face.det_score), 3),
        }
        # Store embedding for comparison (not returned to client)
        if hasattr(face, "embedding") and face.embedding is not None:
            data["_embedding"] = face.embedding
        results.append(data)
    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two face embeddings."""
    a = a.flatten()
    b = b.flatten()
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


# ── Endpoints ──────────────────────────────────────────


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    """Estimate age from a facial image."""
    contents = await image.read()
    img = decode_image(contents)

    start = time.time()
    faces = extract_face_data(img)
    elapsed_ms = (time.time() - start) * 1000

    # Remove internal embeddings from response
    clean = [{k: v for k, v in f.items() if not k.startswith("_")} for f in faces]

    if not clean:
        return {
            "faces": [],
            "face_count": 0,
            "processing_ms": round(elapsed_ms, 1),
            "error": "No face detected in image",
        }

    return {
        "faces": clean,
        "face_count": len(clean),
        "processing_ms": round(elapsed_ms, 1),
    }


@app.post("/compare")
async def compare(
    image1: UploadFile = File(..., description="Document photo"),
    image2: UploadFile = File(..., description="Selfie"),
):
    """
    Compare two faces and return similarity score.

    Returns:
    {
      "match": true/false,
      "similarity": 0.85,
      "threshold": 0.4,
      "face1_age": 25,
      "face2_age": 24,
      "processing_ms": 200
    }
    """
    contents1 = await image1.read()
    contents2 = await image2.read()
    img1 = decode_image(contents1)
    img2 = decode_image(contents2)

    start = time.time()
    faces1 = extract_face_data(img1)
    faces2 = extract_face_data(img2)
    elapsed_ms = (time.time() - start) * 1000

    if not faces1:
        return JSONResponse(
            status_code=200,
            content={"error": "No face detected in document image", "match": False},
        )
    if not faces2:
        return JSONResponse(
            status_code=200,
            content={"error": "No face detected in selfie", "match": False},
        )

    emb1 = faces1[0].get("_embedding")
    emb2 = faces2[0].get("_embedding")

    if emb1 is None or emb2 is None:
        return JSONResponse(
            status_code=200,
            content={"error": "Could not extract face embeddings", "match": False},
        )

    similarity = cosine_similarity(emb1, emb2)

    # Threshold: 0.4 is a good balance for document vs selfie
    # (different lighting, angle, age difference in photo)
    threshold = 0.4
    match = similarity >= threshold

    return {
        "match": match,
        "similarity": round(similarity, 4),
        "threshold": threshold,
        "face1_age": faces1[0]["age"],
        "face1_gender": faces1[0]["gender"],
        "face2_age": faces2[0]["age"],
        "face2_gender": faces2[0]["gender"],
        "processing_ms": round(elapsed_ms, 1),
    }


@app.post("/kyc")
async def kyc(
    document: UploadFile = File(..., description="Document photo (RG/CNH)"),
    selfie: UploadFile = File(..., description="Live selfie"),
):
    """
    Full KYC verification:
    1. Detect face in document
    2. Detect face in selfie
    3. Compare faces (embedding similarity)
    4. Estimate age from selfie

    Returns:
    {
      "face_match": true,
      "similarity": 0.72,
      "selfie_age": 14,
      "selfie_gender": "M",
      "document_age": 14,
      "processing_ms": 350,
      "verdict": "match" | "mismatch" | "no_face_document" | "no_face_selfie"
    }
    """
    doc_contents = await document.read()
    selfie_contents = await selfie.read()
    doc_img = decode_image(doc_contents)
    selfie_img = decode_image(selfie_contents)

    start = time.time()

    # Extract faces
    doc_faces = extract_face_data(doc_img)
    selfie_faces = extract_face_data(selfie_img)

    if not doc_faces:
        return {
            "verdict": "no_face_document",
            "error": "Nenhum rosto detectado na foto do documento",
            "processing_ms": round((time.time() - start) * 1000, 1),
        }

    if not selfie_faces:
        return {
            "verdict": "no_face_selfie",
            "error": "Nenhum rosto detectado na selfie",
            "processing_ms": round((time.time() - start) * 1000, 1),
        }

    # Face comparison
    doc_emb = doc_faces[0].get("_embedding")
    selfie_emb = selfie_faces[0].get("_embedding")
    similarity = 0.0
    face_match = False

    if doc_emb is not None and selfie_emb is not None:
        similarity = cosine_similarity(doc_emb, selfie_emb)
        face_match = similarity >= 0.4

    elapsed_ms = (time.time() - start) * 1000

    verdict = "match" if face_match else "mismatch"

    return {
        "verdict": verdict,
        "face_match": face_match,
        "similarity": round(similarity, 4),
        "selfie_age": selfie_faces[0]["age"],
        "selfie_gender": selfie_faces[0]["gender"],
        "document_age": doc_faces[0]["age"],
        "document_gender": doc_faces[0]["gender"],
        "processing_ms": round(elapsed_ms, 1),
    }
