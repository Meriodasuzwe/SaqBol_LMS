from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('quizzes', '0008_quiz_import_receipt')]
    operations = [
        migrations.AddField(
            model_name='question', name='topic',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='Тема'),
        ),
    ]
