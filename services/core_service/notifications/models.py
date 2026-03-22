from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPES = (
        ('course_approved',  'Курс опубликован'),
        ('course_rejected',  'Курс отклонён'),
        ('app_approved',     'Заявка одобрена'),
        ('app_rejected',     'Заявка отклонена'),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='Получатель'
    )
    notification_type = models.CharField(max_length=30, choices=TYPES)
    title   = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Уведомление'
        verbose_name_plural = 'Уведомления'

    def __str__(self):
        return f"{self.recipient.username} — {self.title}"