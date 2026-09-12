from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Task
from datetime import date

task_bp = Blueprint('task_bp', __name__)

def parse_date(date_str):
    if not date_str:
        return None
    try:
        return date.fromisoformat(str(date_str).strip())
    except (ValueError, TypeError):
        return None

def task_to_dict(task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "is_completed": task.is_completed,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "due_time": getattr(task, 'due_time', None),
        "status": task.status or ('completed' if task.is_completed else 'todo'),
        "category": task.category or 'Project',
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None
    }

@task_bp.route('', methods=['GET'])
@jwt_required()
def get_tasks():
    try:
        user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"message": "Sesi tidak valid. Silakan login kembali."}), 401
        
    filter_type = request.args.get('filter', 'all')
    category = request.args.get('category')
    
    query = Task.query.filter_by(user_id=user_id)
    
    if category:
        query = query.filter_by(category=category)

    if filter_type == 'active':
        query = query.filter_by(is_completed=False)
    elif filter_type == 'completed':
        query = query.filter_by(is_completed=True)
        
    tasks = query.order_by(Task.created_at.desc()).all()
    return jsonify({"tasks": [task_to_dict(t) for t in tasks]}), 200

@task_bp.route('', methods=['POST'])
@jwt_required()
def create_task():
    try:
        user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"message": "Sesi tidak valid. Silakan login kembali."}), 401
        
    data = request.get_json(silent=True)
    
    if not data or not data.get('title') or not str(data.get('title')).strip():
        return jsonify({"message": "Judul tugas wajib diisi."}), 400
        
    status = data.get('status', 'todo')
    is_completed = (status == 'completed') or bool(data.get('is_completed', False))
    due_time = str(data.get('due_time')).strip()[:10] if data.get('due_time') else None

    new_task = Task(
        user_id=user_id,
        title=str(data['title']).strip(),
        description=str(data.get('description', '')).strip() if data.get('description') else '',
        is_completed=is_completed,
        due_date=parse_date(data.get('due_date')),
        due_time=due_time,
        status='completed' if is_completed else status,
        category=data.get('category', 'Project')
    )
    
    try:
        db.session.add(new_task)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal menyimpan tugas ke database: {str(e)}"}), 500
    
    return jsonify({
        "message": "Tugas berhasil dibuat",
        "task": task_to_dict(new_task)
    }), 201

@task_bp.route('/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    try:
        user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"message": "Sesi tidak valid. Silakan login kembali."}), 401
        
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    
    if not task:
        return jsonify({"message": "Tugas tidak ditemukan."}), 404
        
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Data permintaan tidak valid."}), 400
        
    if 'title' in data:
        if not str(data['title']).strip():
            return jsonify({"message": "Judul tugas tidak boleh kosong."}), 400
        task.title = str(data['title']).strip()
    if 'description' in data:
        task.description = str(data['description']).strip() if data['description'] else ''
    if 'category' in data:
        task.category = data['category']
    if 'due_date' in data:
        task.due_date = parse_date(data.get('due_date'))
    if 'due_time' in data:
        task.due_time = str(data['due_time']).strip()[:10] if data['due_time'] else None
    if 'status' in data:
        task.status = data['status']
        task.is_completed = (data['status'] == 'completed')
    if 'is_completed' in data:
        task.is_completed = bool(data['is_completed'])
        if task.is_completed:
            task.status = 'completed'
        elif task.status == 'completed':
            task.status = 'todo'
        
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal memperbarui tugas: {str(e)}"}), 500
    
    return jsonify({
        "message": "Tugas berhasil diperbarui",
        "task": task_to_dict(task)
    }), 200

@task_bp.route('/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    try:
        user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"message": "Sesi tidak valid. Silakan login kembali."}), 401
        
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    
    if not task:
        return jsonify({"message": "Tugas tidak ditemukan."}), 404
        
    try:
        db.session.delete(task)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal menghapus tugas: {str(e)}"}), 500
    
    return jsonify({"message": "Tugas berhasil dihapus"}), 200
