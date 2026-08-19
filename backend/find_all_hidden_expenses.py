import os, sys, io, sqlite3, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=== 1. KOMPYUTERDAGI/LOYIHADAGI BARCHA SQLITE BAZALARNIKI QIDIRISH ===")

project_dir = "c:\\Users\\hp\\OneDrive\\Desktop\\mms crm"
db_files = glob.glob(os.path.join(project_dir, "**", "*.db*"), recursive=True)

for db_path in db_files:
    print(f"\n📂 Qidirilayotgan baza fayli: {db_path} (Hajmi: {os.path.getsize(db_path)} bayt)")
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Check if table expenses exists
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cur.fetchall()]
        print(f"   Jadvallar: {tables}")
        
        if "expenses" in tables:
            cur.execute("SELECT * FROM expenses")
            rows = cur.fetchall()
            print(f"   --> 'expenses' jadvalida {len(rows)} ta qator topildi:")
            for r in rows:
                print(f"       {r}")
        if "provider_advances" in tables:
            cur.execute("SELECT * FROM provider_advances")
            prows = cur.fetchall()
            print(f"   --> 'provider_advances' jadvalida {len(prows)} ta qator topildi:")
            for r in prows:
                print(f"       {r}")
        if "advances" in tables:
            cur.execute("SELECT * FROM advances")
            arows = cur.fetchall()
            print(f"   --> 'advances' jadvalida {len(arows)} ta qator topildi:")
            for r in arows:
                print(f"       {r}")
        if "balance_history" in tables:
            cur.execute("SELECT * FROM balance_history WHERE entry_type LIKE '%exp%' OR entry_type LIKE '%out%' OR description LIKE '%haraj%' OR description LIKE '%xaraj%'")
            brows = cur.fetchall()
            print(f"   --> 'balance_history' jadvalida {len(brows)} ta chiqim qatori topildi:")
            for r in brows:
                print(f"       {r}")
        conn.close()
    except Exception as e:
        print(f"   ❌ O'qishda xatolik: {e}")

print("\n==================================================")
