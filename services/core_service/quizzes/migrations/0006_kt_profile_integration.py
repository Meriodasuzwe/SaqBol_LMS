from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def refuse_kt_metadata_rollback(apps, schema_editor):
    database = schema_editor.connection.alias
    quizzes = apps.get_model('quizzes', 'Quiz').objects.using(database)
    questions = apps.get_model('quizzes', 'Question').objects.using(database)
    results = apps.get_model('quizzes', 'Result').objects.using(database)
    if (quizzes.exclude(mode='training').exists()
            or questions.exclude(kt_subject='').exists()
            or results.exclude(scoring_mode='training').exists()
            or results.filter(scoring_details__isnull=False).exists()):
        raise IrreversibleError('Cannot discard saved KT scoring or subject metadata.')


class Migration(migrations.Migration):
    dependencies = [('quizzes', '0005_preserve_results_on_quiz_deletion')]

    operations = [
        migrations.AddField(
            model_name='quiz', name='mode',
            field=models.CharField(choices=[('training', 'Тренировка'), ('kt_profile', 'Пробник профильного блока КТ')],
                                   default='training', max_length=20),
        ),
        migrations.AddField(
            model_name='question', name='kt_subject',
            field=models.CharField(blank=True, choices=[('first_subject', 'Первый профильный предмет'),
                                                       ('second_subject', 'Второй профильный предмет')],
                                   default='', max_length=20),
        ),
        migrations.AddField(
            model_name='result', name='scoring_mode',
            field=models.CharField(choices=[('training', 'Тренировка'), ('kt_profile', 'Пробник профильного блока КТ')],
                                   default='training', editable=False, max_length=20),
        ),
        migrations.AddField(
            model_name='result', name='scoring_details',
            field=models.JSONField(blank=True, editable=False, null=True),
        ),
        migrations.RunPython(migrations.RunPython.noop, refuse_kt_metadata_rollback),
    ]
