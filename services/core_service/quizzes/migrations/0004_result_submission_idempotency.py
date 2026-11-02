from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('quizzes', '0003_alter_quiz_lesson')]

    operations = [
        migrations.AddField(
            model_name='result', name='submission_id',
            field=models.UUIDField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name='result', name='submission_fingerprint',
            field=models.CharField(blank=True, editable=False, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='result', name='submission_response',
            field=models.JSONField(blank=True, editable=False, null=True),
        ),
        migrations.AddConstraint(
            model_name='result',
            constraint=models.UniqueConstraint(
                fields=('student', 'quiz', 'submission_id'),
                name='unique_student_quiz_submission',
            ),
        ),
    ]
