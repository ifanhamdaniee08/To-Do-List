from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Task
from datetime import date, timedelta
from collections import defaultdict

analytics_bp = Blueprint('analytics_bp', __name__)

DAY_NAMES_ID = {
    0: 'Senin',
    1: 'Selasa',
    2: 'Rabu',
    3: 'Kamis',
    4: 'Jumat',
    5: 'Sabtu',
    6: 'Minggu'
}

MONTH_NAMES_ID = {
    1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
    5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
    9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
}

@analytics_bp.route('', methods=['GET'])
@jwt_required()
def get_analytics():
    try:
        user_id = int(get_jwt_identity())
    except (ValueError, TypeError):
        return jsonify({"message": "Sesi tidak valid. Silakan login kembali."}), 401

    tasks = Task.query.filter_by(user_id=user_id).all()
    today = date.today()

    total_tasks = len(tasks)
    completed_tasks = [t for t in tasks if t.is_completed or t.status == 'completed']
    active_tasks = [t for t in tasks if not t.is_completed and t.status != 'completed']

    completed_count = len(completed_tasks)
    active_count = len(active_tasks)
    completion_rate = round((completed_count / total_tasks * 100)) if total_tasks > 0 else 0

    # Overdue tasks (active and due_date < today)
    overdue_count = sum(1 for t in active_tasks if t.due_date and t.due_date < today)

    # On-time completions
    completed_with_due = [t for t in completed_tasks if t.due_date]
    on_time_count = 0
    for t in completed_with_due:
        comp_date = t.updated_at.date() if t.updated_at else today
        if comp_date <= t.due_date:
            on_time_count += 1
    on_time_rate = round((on_time_count / len(completed_with_due) * 100)) if len(completed_with_due) > 0 else 100

    # Day of week and Month productivity analysis
    day_counts = defaultdict(int)
    month_counts = defaultdict(int)
    date_completed_set = set()

    for t in completed_tasks:
        comp_dt = t.updated_at or t.created_at
        if comp_dt:
            comp_date = comp_dt.date()
            date_completed_set.add(comp_date)
            weekday = comp_date.weekday()
            day_counts[weekday] += 1

            m_key = f"{MONTH_NAMES_ID.get(comp_date.month, '')} {comp_date.year}"
            month_counts[m_key] += 1

    peak_day = None
    if day_counts:
        best_weekday, best_weekday_count = max(day_counts.items(), key=lambda x: x[1])
        peak_day = {
            "day": DAY_NAMES_ID.get(best_weekday, 'Hari'),
            "count": best_weekday_count
        }

    peak_month = None
    if month_counts:
        best_month_key, best_month_count = max(month_counts.items(), key=lambda x: x[1])
        peak_month = {
            "month": best_month_key,
            "count": best_month_count
        }

    # Weekly Activity (Last 7 days from today)
    weekly_activity = []
    for i in range(6, -1, -1):
        target_day = today - timedelta(days=i)
        day_completed = sum(1 for t in completed_tasks if t.updated_at and t.updated_at.date() == target_day)
        weekly_activity.append({
            "day_name": DAY_NAMES_ID.get(target_day.weekday(), '')[:3],
            "full_day": DAY_NAMES_ID.get(target_day.weekday(), ''),
            "date": target_day.isoformat(),
            "count": day_completed,
            "is_today": target_day == today
        })

    # Productivity Streak calculation (consecutive days with at least 1 completed task)
    streak_count = 0
    check_date = today
    # If today has completed task, count streak including today; otherwise check starting yesterday
    if today in date_completed_set:
        streak_count += 1
        check_date = today - timedelta(days=1)
    else:
        check_date = today - timedelta(days=1)

    while check_date in date_completed_set:
        streak_count += 1
        check_date -= timedelta(days=1)

    # Category breakdown for completed tasks
    cat_counts = defaultdict(int)
    for t in completed_tasks:
        cat = t.category or 'Project'
        cat_counts[cat] += 1

    category_breakdown = []
    for cat, cnt in sorted(cat_counts.items(), key=lambda x: x[1], reverse=True):
        pct = round((cnt / completed_count * 100)) if completed_count > 0 else 0
        category_breakdown.append({
            "category": cat,
            "count": cnt,
            "percentage": pct
        })

    return jsonify({
        "total_tasks": total_tasks,
        "completed_count": completed_count,
        "active_count": active_count,
        "completion_rate": completion_rate,
        "overdue_count": overdue_count,
        "on_time_count": on_time_count,
        "on_time_rate": on_time_rate,
        "peak_day": peak_day,
        "peak_month": peak_month,
        "weekly_activity": weekly_activity,
        "streak_days": streak_count,
        "category_breakdown": category_breakdown
    }), 200
