from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Optional backend/.env for local runs (e.g. DATABASE_URL, ANTHROPIC_API_KEY); no-op on Vercel
load_dotenv(os.path.join(BASE_DIR, ".env"))

# DATABASE_URL set   → shared Postgres (Supabase) — the hosted web app
# DATABASE_URL unset → local SQLite file — the single-user desktop setup
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_SQLITE = not DATABASE_URL


def _sqlalchemy_postgres_url(url: str) -> str:
    """Supabase hands out postgres:// / postgresql:// URLs; point them at the psycopg 3 driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


if IS_SQLITE:
    engine = create_engine(
        f"sqlite:///{os.path.join(BASE_DIR, 'metal_am_cost.db')}",
        connect_args={"check_same_thread": False},
    )
else:
    # Serverless: let Supabase's pooler do the pooling (NullPool), and disable
    # prepared statements, which its transaction mode (port 6543) doesn't support.
    engine = create_engine(
        _sqlalchemy_postgres_url(DATABASE_URL),
        poolclass=NullPool,
        connect_args={"prepare_threshold": None},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
