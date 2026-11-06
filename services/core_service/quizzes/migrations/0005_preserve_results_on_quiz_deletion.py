from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError
import django.db.models.deletion


def refuse_detached_results_rollback(apps, schema_editor):
    results = apps.get_model('quizzes', 'Result').objects.using(schema_editor.connection.alias)
    if results.filter(quiz_id__isnull=True).exists():
        raise IrreversibleError('Cannot require a live quiz for preserved results of deleted quizzes.')


class Migration(migrations.Migration):
    dependencies = [
        ('quizzes', '0004_result_submission_idempotency'),
        ('analytics', '0003_preserve_question_snapshots'),
    ]

    operations = [
        migrations.AlterField(
            model_name='result', name='quiz',
            field=models.ForeignKey(blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL, to='quizzes.quiz'),
        ),
        migrations.RunPython(migrations.RunPython.noop, refuse_detached_results_rollback),
    ]
