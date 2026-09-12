import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

raw_db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/todolist_db')
# Handle postgres:// vs postgresql:// compatibility for cloud providers (Render, Neon, Supabase)
if raw_db_url and raw_db_url.startswith('postgres://'):
    raw_db_url = raw_db_url.replace('postgres://', 'postgresql://', 1)

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default_secret')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'default_jwt_secret')
    
    # SQLAlchemy Configuration
    SQLALCHEMY_DATABASE_URI = raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Google OAuth Configuration
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')

