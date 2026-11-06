from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError
import django.db.models.deletion


def refuse_detached_attempts_rollback(apps, schema_editor):
    attempts = apps.get_model('analytics', 'QuizAttemptDetail').objects.using(schema_editor.connection.alias)
    if attempts.filter(quiz_id__isnull=True).exists():
        raise IrreversibleError('Cannot require a live quiz for preserved attempts of deleted quizzes.')


class Migration(migrations.Migration):
    dependencies = [
        ('analytics', '0003_preserve_question_snapshots'),
        ('quizzes', '0005_preserve_results_on_quiz_deletion'),
    ]

    operations = [
        migrations.AlterField(
            model_name='quizattemptdetail', name='quiz',
            field=models.ForeignKey(blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='attempt_details', to='quizzes.quiz', verbose_name='Квиз'),
        ),
        migrations.RunPython(migrations.RunPython.noop, refuse_detached_attempts_rollback),
    ]
