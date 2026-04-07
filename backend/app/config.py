import os

from dotenv import load_dotenv


def load_config() -> dict:
    """
    Centralized config loader.

    Keep it simple for beginners: config comes from environment variables.
    """
    load_dotenv()

    return {
        "DEBUG": os.getenv("FLASK_DEBUG", "0") == "1",
        "PORT": int(os.getenv("PORT", "5000")),
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
        # Supabase is used for Storage only (frontend uploads directly)
        "SUPABASE_URL": os.getenv("SUPABASE_URL", ""),
        "SUPABASE_ANON_KEY": os.getenv("SUPABASE_ANON_KEY", ""),
        "SUPABASE_JWT_ISSUER": os.getenv("SUPABASE_JWT_ISSUER", ""),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        "APP_JWT_SECRET": os.environ.get("APP_JWT_SECRET", "dev-secret-change-me"),
        # MongoDB
        "MONGODB_URI": os.environ["MONGODB_URI"],
        "MONGODB_DB": os.getenv("MONGODB_DB", "classroom_mvp"),
        "GROQ_API_KEY": os.getenv("GROQ_API_KEY", ""),
    }

