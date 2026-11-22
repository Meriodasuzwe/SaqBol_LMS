from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('quizzes', '0009_question_topic'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name='BankQuestion', fields=[
        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        ('subject', models.CharField(choices=[('first_subject', 'Первый профильный предмет'), ('second_subject', 'Второй профильный предмет')], max_length=20)),
        ('topic', models.CharField(max_length=255)),
        ('language', models.CharField(choices=[('ru', 'Русский'), ('kk', 'Қазақша')], max_length=2)),
        ('usage', models.CharField(choices=[('exam', 'Пробники'), ('training', 'Тренировки'), ('both', 'Тренировки и пробники')], default='exam', max_length=10)),
        ('text', models.TextField()), ('explanation', models.TextField(blank=True, default='')),
        ('choices', models.JSONField(default=list)), ('revision', models.PositiveIntegerField(default=1)),
        ('created_at', models.DateTimeField(auto_now_add=True)), ('updated_at', models.DateTimeField(auto_now=True)),
        ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
    ])]
