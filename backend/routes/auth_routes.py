from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from models import db, User
import os

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data or 'full_name' not in data:
        return jsonify({"message": "Nama lengkap, email, dan password wajib diisi."}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"message": "Email sudah terdaftar. Silakan gunakan email lain atau login."}), 409
    
    hashed_pw = generate_password_hash(data['password'])
    new_user = User(
        email=data['email'],
        password_hash=hashed_pw,
        full_name=data['full_name']
    )
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({
        "message": "Registrasi berhasil.",
        "user": {"id": new_user.id, "email": new_user.email, "full_name": new_user.full_name}
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"message": "Email dan kata sandi wajib diisi."}), 400
        
    user = User.query.filter_by(email=data['email']).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, data['password']):
        return jsonify({"message": "Email atau password yang Anda masukkan salah. Silakan periksa kembali!"}), 401
        
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "token": access_token,
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name}
    }), 200

@auth_bp.route('/google', methods=['POST'])
def google_auth():
    data = request.get_json()
    credential = data.get('credential')
    
    if not credential:
        return jsonify({"message": "No credential provided"}), 400
        
    try:
        idinfo = id_token.verify_oauth2_token(
            credential, 
            google_requests.Request(), 
            os.getenv('GOOGLE_CLIENT_ID')
        )
        
        email = idinfo['email']
        google_id = idinfo['sub']
        full_name = idinfo.get('name', '')
        avatar_url = idinfo.get('picture', '')
        
        user = User.query.filter_by(email=email).first()
        if not user:
            # Create new user from google info
            user = User(
                email=email,
                full_name=full_name,
                google_id=google_id,
                avatar_url=avatar_url
            )
            db.session.add(user)
            db.session.commit()
        elif not user.google_id:
            # Link existing local account with google account
            user.google_id = google_id
            user.avatar_url = avatar_url
            db.session.commit()
            
        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            "token": access_token,
            "user": {
                "id": user.id, 
                "email": user.email, 
                "full_name": user.full_name,
                "avatar_url": user.avatar_url
            }
        }), 200
        
    except ValueError:
        return jsonify({"message": "Invalid token"}), 401

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
        
    return jsonify({
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url
    }), 200
