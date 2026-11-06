"""One bounded pass over expired exams. Scheduling is a deployment concern."""
from django.core.management.base import BaseCommand, CommandError
from quizzes.exam_services import expire_due_attempts


class Command(BaseCommand):
    help = 'Завершить просроченные экзаменационные попытки по уже сохранённым ответам.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        limit = options['limit']
        if not 1 <= limit <= 10000:
            raise CommandError('limit должен быть от 1 до 10000.')
        count = expire_due_attempts(limit=limit)
        self.stdout.write(f'Finalized expired exam attempts: {count}')
