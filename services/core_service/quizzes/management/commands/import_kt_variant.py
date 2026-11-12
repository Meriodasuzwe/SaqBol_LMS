from django.core.management.base import BaseCommand, CommandError

from quizzes.kt_variant_import import PackageError, import_variant, load_package


class Command(BaseCommand):
    help = 'Проверить или загрузить один фиксированный комплект 30 + 20. Не публикует и не привязывает пробник.'

    def add_arguments(self, parser):
        parser.add_argument('path', help='Путь к JSON UTF-8 версии 1')
        parser.add_argument('--quiz-id', required=True, type=int, help='ID существующего целевого Quiz')
        mode = parser.add_mutually_exclusive_group(required=True)
        mode.add_argument('--dry-run', action='store_true', help='Проверить файл и Quiz без записи')
        mode.add_argument('--apply', action='store_true', help='Явно разрешить атомарную запись')

    def handle(self, *args, **options):
        if bool(options.get('dry_run')) == bool(options.get('apply')):
            raise CommandError('Выберите ровно один режим: --dry-run или --apply.')
        try:
            report = import_variant(load_package(options['path']), options['quiz_id'], apply=options['apply'])
        except PackageError as error:
            raise CommandError(str(error)) from error
        labels = {'ready': 'Проверка пройдена, записей не создано', 'imported': 'Пакет загружен',
                  'already_loaded': 'Уже загружено: пакет и данные совпадают, записей не создано'}
        self.stdout.write(self.style.SUCCESS(f'{labels[report["status"]]}. Quiz={report["quiz_id"]}; package_id={report["package_id"]}'))
        self.stdout.write(f'Вопросов: {report["question_count"]} (30 + 20); вариантов: {report["choice_count"]}; без объяснений: {report["missing_explanations"]}.')
        self.stdout.write(f'package_checksum={report["package_checksum"]}')
        if report['content_checksum']:
            self.stdout.write(f'content_checksum={report["content_checksum"]}')
        if report['missing_explanations']:
            self.stdout.write(self.style.WARNING('Предупреждение: часть вопросов не содержит объяснений.'))
        if report['example_only']:
            self.stdout.write(self.style.WARNING('example_only=true: запись этого примера запрещена.'))
        self.stdout.write('Проверена структура, а не правильность ответов, качество объяснений, квоты НЦТ или права на публикацию. Курс и ключ конфигурации не изменены.')
