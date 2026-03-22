"""
notifications/service.py

Единое место для создания уведомлений + отправки email.
Импортируй send_notification() в любой view где нужно уведомить пользователя.
"""

import logging
from django.conf import settings
from django.core.mail import send_mail
from .models import Notification

logger = logging.getLogger(__name__)


def send_notification(
    recipient,
    notification_type: str,
    title: str,
    message: str,
    send_email: bool = True,
):
    """
    Создаёт in-app уведомление и опционально отправляет email.

    Параметры:
        recipient          — объект User
        notification_type  — строка из Notification.TYPES
        title              — заголовок уведомления
        message            — тело уведомления
        send_email         — отправлять ли email (по умолчанию True)
    """
    # 1. In-app уведомление в БД
    Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
    )

    # 2. Email (если у пользователя настоящий email, не фейковый Telegram)
    if send_email and recipient.email and '@telegram' not in recipient.email:
        try:
            send_mail(
                subject=f'SaqBol LMS — {title}',
                message=f'Здравствуйте, {recipient.first_name or recipient.username}!\n\n{message}\n\n---\nС уважением, команда SaqBol LMS',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient.email],
                fail_silently=False,
            )
            logger.info(f"Email уведомление отправлено: {recipient.email} — {title}")
        except Exception as e:
            logger.error(f"Ошибка отправки email для {recipient.email}: {e}")
            # Не пробрасываем ошибку — in-app уведомление уже создано