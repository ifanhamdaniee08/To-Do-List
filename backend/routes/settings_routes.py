from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User

settings_bp = Blueprint('settings_bp', __name__)

@settings_bp.route('', methods=['GET'])
@jwt_required(optional=True)
def get_settings():
    """
    Mengambil data preferensi & pengaturan sistem aplikasi.
    Endpoint modular yang siap dikembangkan untuk fitur penuh di masa depan.
    """
    current_user_id = get_jwt_identity()
    user_info = None
    if current_user_id:
        try:
            user = User.query.get(int(current_user_id))
            if user:
                user_info = {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name
                }
        except Exception:
            pass

    return jsonify({
        "status": "coming_soon",
        "message": "Fitur Pengaturan Personal sedang dalam tahap pengembangan aktif.",
        "user": user_info,
        "current_preferences": {
            "theme": "light",
            "pixel_icons": True,
            "sound_effects": True,
            "deadline_reminder": True,
            "language": "id"
        },
        "upcoming_modules": [
            {
                "id": "theme_customizer",
                "title": "Tampilan & Tema",
                "description": "Mode Gelap (Dark Mode), palet warna kustom, dan gaya font retro pixel.",
                "status": "In Development",
                "icon": "🎨"
            },
            {
                "id": "notification_alerts",
                "title": "Notifikasi & Pengingat",
                "description": "Pengingat otomatis tenggat waktu tugas sebelum terlambat via browser & alarm.",
                "status": "Planned",
                "icon": "🔔"
            },
            {
                "id": "account_security",
                "title": "Akun & Keamanan",
                "description": "Perbarui profil, avatar, kata sandi, dan integrasi Google Sign-In.",
                "status": "Planned",
                "icon": "👤"
            },
            {
                "id": "backup_sync",
                "title": "Cadangan & Sinkronisasi",
                "description": "Ekspor data to-do list dan catatan ke format JSON / iCal.",
                "status": "Planned",
                "icon": "💾"
            }
        ]
    }), 200

@settings_bp.route('', methods=['PUT'])
@jwt_required()
def update_settings():
    """
    Endpoint pembaruan preferensi (Placeholder untuk implementasi penuh masa depan)
    """
    data = request.get_json() or {}
    return jsonify({
        "status": "coming_soon",
        "message": "Preferensi Anda telah dicatat. Modul pengaturan penuh akan segera hadir!",
        "received_data": data
    }), 200
