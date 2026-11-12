from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError
import django.db.models.deletion


def preserve_import_provenance(apps, schema_editor):
    if apps.get_model('quizzes', 'QuizImportReceipt').objects.using(schema_editor.connection.alias).exists():
        raise IrreversibleError('Cannot discard import receipts and their provenance.')


class Migration(migrations.Migration):
    dependencies = [('quizzes', '0007_exam_attempt')]
    operations = [
        migrations.CreateModel(
            name='QuizImportReceipt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('package_id', models.CharField(max_length=128, unique=True)),
                ('package_checksum', models.CharField(max_length=64)),
                ('content_checksum', models.CharField(max_length=64)),
                ('manifest', models.JSONField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('quiz', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='import_receipt', to='quizzes.quiz')),
            ],
        ),
        migrations.RunPython(migrations.RunPython.noop, preserve_import_provenance),
    ]
