from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError
import django.db.models.deletion


def refuse_lossy_snapshot_rollback(apps, schema_editor):
    alias = schema_editor.connection.alias
    attempts = apps.get_model('analytics', 'QuizAttemptDetail').objects.using(alias)
    answers = apps.get_model('analytics', 'QuestionAnswer').objects.using(alias)
    if (attempts.filter(quiz_snapshot__isnull=False).exists()
            or answers.filter(question_snapshot__isnull=False).exists()
            or answers.filter(question_id__isnull=True).exists()):
        raise IrreversibleError('Rollback would discard saved attempt content or detached historical answers.')


class Migration(migrations.Migration):
    dependencies = [('analytics', '0002_questionanswer_selected_choice_ids')]

    operations = [
        migrations.AddField(
            model_name='quizattemptdetail', name='quiz_snapshot',
            field=models.JSONField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name='questionanswer', name='question_snapshot',
            field=models.JSONField(blank=True, editable=False, null=True),
        ),
        migrations.AlterField(
            model_name='questionanswer', name='question',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='student_answers', to='quizzes.question', verbose_name='Вопрос',
            ),
        ),
        migrations.RunPython(migrations.RunPython.noop, refuse_lossy_snapshot_rollback),
    ]
