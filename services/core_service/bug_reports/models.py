from django.db import models
import uuid


class BugReport(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новый'),
        ('in_progress', 'В работе'),
        ('resolved', 'Решён'),
        ('closed', 'Закрыт'),
    ]

    CATEGORY_CHOICES = [
        ('ui', 'Интерфейс'),
        ('functionality', 'Функциональность'),
        ('performance', 'Производительность'),
        ('payment', 'Оплата'),
        ('other', 'Другое'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    description = models.TextField()
    page_url = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    admin_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_status_display()}] {self.title}"


class BugReportScreenshot(models.Model):
    report = models.ForeignKey(BugReport, on_delete=models.CASCADE, related_name='screenshots')
    image = models.ImageField(upload_to='bug_screenshots/')
    uploaded_at = models.DateTimeField(auto_now_add=True)