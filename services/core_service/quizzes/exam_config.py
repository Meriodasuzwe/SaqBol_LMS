"""Versioned server configuration. Binding content is a separate explicit action."""
from copy import deepcopy
from django.conf import settings
from .grading import KT_PROFILE_SCORING_VERSION


_PROFILE_SECTIONS = [
    {'id': 'first_subject', 'title': 'Алгоритмы и структуры данных', 'response_type': 'single',
     'question_count': 30, 'max_points': 30},
    {'id': 'second_subject', 'title': 'Базы данных', 'response_type': 'multiple',
     'question_count': 20, 'max_points': 40},
]
_PROFILE = {
    'id': 'm094_profile_ru_v1', 'version': 1, 'format': 'profile',
    'program': {'code': 'M094', 'title': 'Информационные технологии'}, 'language': 'ru',
    'title': 'Профильная магистратура · M094', 'duration_seconds': 6000,
    'total_questions': 50, 'max_points': 70, 'scoring_version': KT_PROFILE_SCORING_VERSION,
    'sections': _PROFILE_SECTIONS, 'is_demo': False,
}


def configurations():
    profile = deepcopy(_PROFILE)
    scientific = {
        **deepcopy(_PROFILE), 'id': 'm094_scientific_ru_v1', 'format': 'scientific',
        'title': 'Научно-педагогическая магистратура · M094', 'duration_seconds': 14100,
        'total_questions': 130, 'max_points': 150, 'scoring_version': None,
        'sections': [
            {'id': 'english', 'title': 'Английский язык', 'response_type': 'single', 'question_count': 50, 'max_points': 50},
            {'id': 'readiness', 'title': 'Тест на определение готовности к обучению', 'response_type': 'single', 'question_count': 30, 'max_points': 30},
            *deepcopy(_PROFILE_SECTIONS),
        ],
        'unavailable_reason': 'Полный формат пока не поддерживается: нет подключённых материалов английского языка и ТГО.',
    }
    demo = {
        **deepcopy(_PROFILE), 'id': 'm094_profile_ru_demo_v1', 'is_demo': True,
        'title': 'Демонстрация двух профильных предметов', 'duration_seconds': None,
        'notice': 'Искусственные данные. Не официальный банк и не полный научно-педагогический пробник. Без экзаменационного таймера.',
    }
    if not getattr(settings, 'EXAM_DEMO_ENABLED', False):
        demo['unavailable_reason'] = 'Техническая демонстрация отключена в этом окружении.'
    return [profile, scientific, demo]


def get_configuration(key):
    return next((item for item in configurations() if item['id'] == key), None)
