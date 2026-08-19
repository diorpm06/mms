# --- QALQON: JONLI BAZAGA ULANISHNI TAQIQLAYDI -------------------------
# Bu skript harajat yaratib, bekor qilib, qayta tiklaydi - ya'ni KASSANI
# QIMIRLATADI. Jonli bazada ishlatilishi mumkin emas.
import os as _os
import sys as _sys
if not _os.environ.get("DATABASE_URL", "").startswith("sqlite"):
    _sys.exit("TO'XTATILDI: test skripti jonli bazada ishlamaydi. "
              "DATABASE_URL sqlite:/// bilan boshlanishi shart.")
# ----------------------------------------------------------------------
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import datetime
from database import SessionLocal
from models.expense import Expense
from models.user import User
from routers.expenses import _perform_expense_cancel, restore_expense, _expense_out

db = SessionLocal()

print("=== VERIFYING EXPENSE CANCEL & RESTORE FEATURE ===")

user = db.query(User).filter(User.role == "admin").first() or db.query(User).first()

# 1. Create temporary test expense
e = Expense(description="Test Restore Expense", amount=25000, category="Boshqa", created_by=user.id)
db.add(e)
db.commit()
db.refresh(e)
print(f"📌 1. Created Test Expense ID: {e.id} | Amount: {e.amount:,} | Description: {e.description}")

# 2. Cancel/Delete expense
_perform_expense_cancel(e, "Testing cancel and restore feature", user, db)
db.refresh(e)
print(f"📌 2. Cancelled Expense ID: {e.id} | is_cancelled: {e.is_cancelled} | Reason: {e.cancel_reason}")
assert e.is_cancelled == True

# 3. Check _expense_out helper
out = _expense_out(e)
assert out["is_cancelled"] == True
assert out["cancel_reason"] == "Testing cancel and restore feature"
print("✓ _expense_out correctly returns cancellation metadata.")

# 4. Restore expense
res = restore_expense(e.id, db=db, user=user)
db.refresh(e)
print(f"📌 3. Restored Expense ID: {e.id} | is_cancelled: {e.is_cancelled}")
assert e.is_cancelled == False

# Cleanup
db.delete(e)
db.commit()
print("✓ Test expense cleaned up successfully.")

print("\n✅ EXPENSE CANCEL & RESTORE FEATURE IS 100% WORKING PERFECTLY!")
