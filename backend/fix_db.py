from app.db.session import engine
from sqlalchemy import text

def add_missing_columns():
    # PostgreSQL では1つでもエラーが出るとトランザクション全体が無効になるため、1カラムずつ別トランザクションで実行する
    def run_one(name: str, sql: str):
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            print(f"{name} カラムを追加しました")
        except Exception as e:
            print(f"{name} は既にあるか、エラーです: {e}")

    run_one("is_verified", "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;")
    run_one("verification_token", "ALTER TABLE users ADD COLUMN verification_token VARCHAR;")
    run_one("goals.current_situation", "ALTER TABLE goals ADD COLUMN current_situation VARCHAR(2000);")

if __name__ == "__main__":
    add_missing_columns()