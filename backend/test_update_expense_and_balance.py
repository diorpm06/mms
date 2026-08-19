import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from datetime import datetime
from database import SessionLocal
from models.expense import Expense
from models.user import User
from services.finance import get_or_create_balance
from routers.expenses import update_expense, ExpenseUpdate

db = SessionLocal()

print("=== VERIFYING EXPENSE EDITING AND AUTOMATIC BALANCE ADJUSTMENT ===")

user = db.query(User).filter(User.role == "admin").first() or db.query(User).first()
bal_initial = get_or_create_balance(db).current_balance

print(f"📌 Initial Kassa Balance: {bal_initial:,} so'm")

# 1. Create a test expense for 100,000 so'm
e = Expense(description="Original Expense Test", amount=100000, category="Boshqa", created_by=user.id)
db.add(e)
bal = get_or_create_balance(db)
bal.current_balance -= 100000
db.commit()
db.refresh(e)

bal_after_create = get_or_create_balance(db).current_balance
print(f"📌 Created Expense ID {e.id} for 100,000 so'm | Balance: {bal_after_create:,} so'm")
assert bal_after_create == bal_initial - 100000

# 2. Update expense amount to 150,000 so'm (+50,000)
update_data = ExpenseUpdate(description="Updated Expense Test (+50k)", amount=150000, category="Ta'mirlash")
update_expense(e.id, update_data, db=db, user=user)

bal_after_increase = get_or_create_balance(db).current_balance
print(f"📌 Increased Expense to 150,000 so'm | Balance: {bal_after_increase:,} so'm")
assert bal_after_increase == bal_initial - 150000

# 3. Update expense amount down to 80,000 so'm (-70,000)
update_data2 = ExpenseUpdate(description="Updated Expense Test (-70k)", amount=80000, category="Ta'mirlash")
update_expense(e.id, update_data2, db=db, user=user)

bal_after_decrease = get_or_create_balance(db).current_balance
print(f"📌 Decreased Expense to 80,000 so'm | Balance: {bal_after_decrease:,} so'm")
assert bal_after_decrease == bal_initial - 80000

# Cleanup
bal = get_or_create_balance(db)
bal.current_balance += 80000
db.delete(e)
db.commit()

bal_final = get_or_create_balance(db).current_balance
print(f"✓ Cleanup done | Final Balance restored to: {bal_final:,} so'm")
assert bal_final == bal_initial

print("\n✅ VERIFICATION SUCCESSFUL: Expense editing, amount adjustments, and cash balance recalculations are 100% WORKING PERFECTLY!")
