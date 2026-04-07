from bson import ObjectId
from flask import Blueprint, jsonify

from ..auth_app import require_auth
from ..mongo import users_col


me_bp = Blueprint("me", __name__)


@me_bp.get("/me")
def me():
    user = require_auth()
    doc = users_col().find_one({"_id": ObjectId(user.id)}, {"password_hash": 0})
    if not doc:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify({"id": str(doc["_id"]), "name": doc["name"], "email": doc["email"], "role": doc["role"]})

