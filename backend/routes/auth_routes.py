from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from models import db, User
import os

auth_bp = Blueprint('auth_bp', __name__)

def verify_google_token_credential(credential):
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    # clock_skew_in_seconds=60 memberi toleransi perbedaan waktu lokal laptop/server dengan server Google
    return id_token.verify_oauth2_token(
        credential, 
        google_requests.Request(), 
        client_id,
        clock_skew_in_seconds=60
    )

import re

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True)
    if not data or 'email' not in data or 'password' not in data or 'full_name' not in data:
        return jsonify({"message": "Nama lengkap, email, dan password wajib diisi."}), 400
    
    full_name = str(data['full_name']).strip()
    email = str(data['email']).strip().lower()
    password = str(data['password'])

    if not full_name or not email or not password:
        return jsonify({"message": "Nama lengkap, email, dan password tidak boleh kosong."}), 400
        
    if len(full_name) < 2:
        return jsonify({"message": "Nama lengkap minimal 2 karakter."}), 400

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify({"message": "Format email tidak valid. Masukkan email yang benar."}), 400

    if len(password) < 6:
        return jsonify({"message": "Kata sandi minimal 6 karakter."}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({
            "message": "Email sudah terdaftar. Silakan gunakan email lain atau langsung masuk ke akun Anda.",
            "code": "USER_ALREADY_EXISTS"
        }), 409
    
    hashed_pw = generate_password_hash(password)
    new_user = User(
        email=email,
        password_hash=hashed_pw,
        full_name=full_name
    )
    
    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal menyimpan data pengguna: {str(e)}"}), 500
    
    return jsonify({
        "message": "Registrasi berhasil! Silakan masuk dengan akun Anda.",
        "user": {
            "id": new_user.id, 
            "email": new_user.email, 
            "full_name": new_user.full_name
        }
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True)
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"message": "Email dan kata sandi wajib diisi."}), 400
        
    email = str(data['email']).strip().lower()
    password = str(data['password'])

    if not email or not password:
        return jsonify({"message": "Email dan kata sandi tidak boleh kosong."}), 400

    user = User.query.filter_by(email=email).first()
    
    # BR-01: Tolak login jika email belum pernah didaftarkan
    if not user:
        return jsonify({
            "message": "Akun dengan email ini belum terdaftar. Silakan lakukan pendaftaran (Sign Up) terlebih dahulu.",
            "code": "USER_NOT_FOUND"
        }), 404

    # BR-03: Cek jika akun hanya terdaftar lewat Google (tidak memiliki password hash lokal)
    if not user.password_hash:
        return jsonify({
            "message": "Akun ini terdaftar menggunakan akun Google. Silakan masuk menggunakan tombol Masuk dengan Google.",
            "code": "GOOGLE_AUTH_REQUIRED"
        }), 400
        
    # BR-02: Verifikasi kecocokan password
    if not check_password_hash(user.password_hash, password):
        return jsonify({
            "message": "Kata sandi yang Anda masukkan salah. Silakan periksa kembali!",
            "code": "INVALID_PASSWORD"
        }), 401
        
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

@auth_bp.route('/google/login', methods=['POST'])
def google_login():
    data = request.get_json(silent=True)
    credential = data.get('credential') if data else None
    
    if not credential:
        return jsonify({"message": "Token Google tidak ditemukan."}), 400
        
    try:
        idinfo = verify_google_token_credential(credential)
        email = str(idinfo.get('email', '')).strip().lower()
        google_id = idinfo.get('sub')
        avatar_url = idinfo.get('picture', '')
        
        if not email:
            return jsonify({"message": "Gagal membaca email dari profil Google."}), 400

        user = User.query.filter_by(email=email).first()
        
        # BR-04: Wajib Sign Up terlebih dahulu - tolak jika belum terdaftar
        if not user:
            return jsonify({
                "message": "Akun Google ini belum terdaftar di TaskMaster. Silakan lakukan pendaftaran (Sign Up) terlebih dahulu!",
                "code": "USER_NOT_REGISTERED"
            }), 404
            
        # BR-05: Berhasil login - perbarui google_id / avatar jika belum ada
        updated = False
        if not user.google_id and google_id:
            user.google_id = google_id
            updated = True
        if not user.avatar_url and avatar_url:
            user.avatar_url = avatar_url
            updated = True
            
        if updated:
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
        
    except ValueError as e:
        return jsonify({"message": f"Token Google tidak valid: {str(e)}"}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal masuk dengan Google: {str(e)}"}), 500

@auth_bp.route('/google/register', methods=['POST'])
def google_register():
    data = request.get_json(silent=True)
    credential = data.get('credential') if data else None
    
    if not credential:
        return jsonify({"message": "Token Google tidak ditemukan."}), 400
        
    try:
        idinfo = verify_google_token_credential(credential)
        email = str(idinfo.get('email', '')).strip().lower()
        google_id = idinfo.get('sub')
        full_name = idinfo.get('name') or email.split('@')[0]
        avatar_url = idinfo.get('picture', '')
        
        if not email:
            return jsonify({"message": "Gagal membaca email dari profil Google."}), 400

        user = User.query.filter_by(email=email).first()
        
        # BR-09: Jika akun Google sudah terdaftar, beri tahu user untuk beralih ke Log In
        if user:
            return jsonify({
                "message": "Akun Google ini sudah terdaftar sebelumnya. Silakan beralih ke tab Log In untuk masuk.",
                "code": "USER_ALREADY_EXISTS"
            }), 409
            
        # BR-08: Buat pengguna baru dari data akun Google
        new_user = User(
            email=email,
            full_name=full_name,
            google_id=google_id,
            avatar_url=avatar_url
        )
        db.session.add(new_user)
        db.session.commit()
        
        access_token = create_access_token(identity=str(new_user.id))
        return jsonify({
            "message": "Pendaftaran dengan akun Google berhasil!",
            "token": access_token,
            "user": {
                "id": new_user.id, 
                "email": new_user.email, 
                "full_name": new_user.full_name,
                "avatar_url": new_user.avatar_url
            }
        }), 201
        
    except ValueError as e:
        return jsonify({"message": f"Token Google tidak valid: {str(e)}"}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal mendaftar dengan Google: {str(e)}"}), 500

# Endpoint kompatibilitas untuk request yang mengarah ke /api/auth/google
@auth_bp.route('/google', methods=['POST'])
def google_auth_legacy():
    data = request.get_json(silent=True) or {}
    action = data.get('action', 'login')
    if action == 'register':
        return google_register()
    return google_login()

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
