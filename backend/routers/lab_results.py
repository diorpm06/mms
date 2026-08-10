from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.patient import Patient
from models.user import User
from auth_utils import get_current_user, require_doctor_or_admin_or_ceo

router = APIRouter(prefix="/api/lab-results", tags=["lab-results"])


class LabResultCreate(BaseModel):
    patient_id: int
    test_name: str
    category: str = "Qon tahlili"
    results_json: str # JSON string of parameter: value pairs
    notes: Optional[str] = None


@router.get("/patient/{patient_id}")
def get_patient_lab_results(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import text
    query = text("SELECT id, patient_id, test_name, category, results_json, doctor_name, notes, created_at FROM lab_results WHERE patient_id = :pid ORDER BY created_at DESC")
    rows = db.execute(query, {"pid": patient_id}).fetchall()
    return [
        {
            "id": r[0],
            "patient_id": r[1],
            "test_name": r[2],
            "category": r[3],
            "results_json": r[4],
            "doctor_name": r[5],
            "notes": r[6],
            "created_at": r[7],
        }
        for r in rows
    ]


@router.post("")
def create_lab_result(
    body: LabResultCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_doctor_or_admin_or_ceo),
):
    p = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Bemor topilmadi")

    from sqlalchemy import text
    query = text("""
        INSERT INTO lab_results (patient_id, test_name, category, results_json, doctor_name, notes, created_at)
        VALUES (:pid, :tname, :cat, :rjson, :doc, :notes, :created)
    """)
    db.execute(query, {
        "pid": body.patient_id,
        "tname": body.test_name,
        "cat": body.category,
        "rjson": body.results_json,
        "doc": user.full_name,
        "notes": body.notes,
        "created": datetime.utcnow().isoformat(),
    })
    db.commit()
    return {"message": "Tahlil natijasi saqlandi ✓"}
