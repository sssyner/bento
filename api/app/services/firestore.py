import os
import firebase_admin
from firebase_admin import credentials, firestore
from app.config import FIREBASE_CREDENTIALS_PATH

_initialized = False


def init_firebase():
    global _initialized
    if _initialized:
        return
    if FIREBASE_CREDENTIALS_PATH and os.path.exists(FIREBASE_CREDENTIALS_PATH):
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
    else:
        # Use Application Default Credentials (for Cloud Run / local emulator)
        firebase_admin.initialize_app()
    _initialized = True


def get_db() -> firestore.client:
    init_firebase()
    return firestore.client()


def get_user_company_id(db, uid: str) -> str:
    """Get the companyId for a user. Returns empty string if not found."""
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    if user_doc.exists:
        return user_doc.to_dict().get("companyId", "")
    return ""


def get_company_collection(db, company_id: str, collection: str):
    return db.collection("companies").document(company_id).collection(collection)
