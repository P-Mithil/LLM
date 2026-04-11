from flask import Flask, jsonify
from flask_cors import CORS

from .config import load_config
from .auth_app import AuthError
from .mongo import ensure_indexes
from .routes.assignments import assignments_bp
from .routes.auth_routes import auth_bp
from .routes.ai import ai_bp
from .routes.announcements import announcements_bp
from .routes.classrooms import classrooms_bp
from .routes.health import health_bp
from .routes.me import me_bp
from .routes.messages import messages_bp
from .routes.submissions import submissions_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.update(load_config())

    with app.app_context():
        ensure_indexes()

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(me_bp, url_prefix="/api")
    app.register_blueprint(classrooms_bp, url_prefix="/api")
    app.register_blueprint(assignments_bp, url_prefix="/api")
    app.register_blueprint(submissions_bp, url_prefix="/api")
    app.register_blueprint(messages_bp, url_prefix="/api")
    app.register_blueprint(announcements_bp, url_prefix="/api")
    app.register_blueprint(ai_bp, url_prefix="/api")

    @app.errorhandler(AuthError)
    def handle_auth_error(err: AuthError):
        return jsonify({"error": str(err)}), err.status_code

    @app.errorhandler(Exception)
    def handle_unexpected_error(err: Exception):
        # Keep responses consistent; surface details for debugging in dev.
        if app.config.get("DEBUG"):
            return jsonify({"error": "Internal server error", "details": str(err)}), 500
        return jsonify({"error": "Internal server error"}), 500

    return app

