from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('quizzes', '0010_bankquestion'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name='ExamDraft',fields=[
        ('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),
        ('request_id',models.UUIDField()), ('fingerprint',models.CharField(max_length=64)),
        ('title',models.CharField(max_length=255)),
        ('language',models.CharField(choices=[('ru','Русский'),('kk','Қазақша')],max_length=2)),
        ('snapshot',models.JSONField()), ('created_at',models.DateTimeField(auto_now_add=True)),
        ('owner',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,to=settings.AUTH_USER_MODEL)),
    ],options={'constraints':[models.UniqueConstraint(fields=('owner','request_id'),name='unique_exam_draft_request')]})]
