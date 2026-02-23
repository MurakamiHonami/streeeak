from app.db.session import engine
from sqlalchemy import text

def add_missing_columns():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;"))
            print("is_verified カラムを追加しました")
        except Exception as e:
            print(f"is_verified は既にあるか、エラーです: {e}")

        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN verification_token VARCHAR;"))
            print("verification_token カラムを追加しました")
        except Exception as e:
            print(f"verification_token は既にあるか、エラーです: {e}")

if __name__ == "__main__":
    add_missing_columns()