"""Synthetic importer packages for isolated tests only.

Not official KT questions or verified learning material. This module neither
accesses a database nor creates a production package; do not publish its output.
"""


def make_package(package_id='synthetic-kt-variant-001'):
    """Return a fresh artificial, explicitly example-only 30 + 20 package."""
    questions = []
    for index in range(50):
        first = index < 30
        local_id = f'synthetic-q-{index + 1:02d}'
        choices = [
            {'id': f'{local_id}-c-{number}', 'text': f'Artificial option {number}'}
            for number in range(1, 5)
        ]
        key_count = 1 if first else (index - 30) % 3 + 1
        questions.append({
            'id': local_id,
            'kt_subject': 'first_subject' if first else 'second_subject',
            'source': {
                'id': 'synthetic-first' if first else 'synthetic-second',
                'location': f'Artificial test item {index + 1}; no official source',
            },
            'text': f'Artificial question {index + 1}: choose the synthetic key.',
            'choices': choices,
            'correct_choice_ids': [choice['id'] for choice in choices[:key_count]],
            'explanation': f'Artificial explanation {index + 1}; test data only.',
        })
    return {
        'schema_version': 1,
        'package_id': package_id,
        'example_only': True,
        'sources': [
            {'id': 'synthetic-first', 'title': 'Artificial first subject; test only'},
            {
                'id': 'synthetic-second',
                'title': 'Artificial second subject; test only',
                'file_sha256': 'a' * 64,
            },
        ],
        'questions': questions,
    }
