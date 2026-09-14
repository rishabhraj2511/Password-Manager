import os

from urllib.parse import quote_plus

from dotenv import load_dotenv

from sqlalchemy import create_engine

from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DB_USER = os.getenv("DB_USER")

DB_PASSWORD = quote_plus(os.getenv("DB_PASSWORD", ""))

DB_HOST = os.getenv("DB_HOST")

DB_PORT = os.getenv("DB_PORT")

DB_NAME = os.getenv("DB_NAME")

DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()