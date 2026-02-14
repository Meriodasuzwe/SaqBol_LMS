import logging
import time

# Получаем наш специальный логгер, который мы настроим в settings.py
security_logger = logging.getLogger('security')

class SecurityAuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Засекаем время начала запроса
        start_time = time.time()

        # 2. Пытаемся получить настоящий IP пользователя (даже через Nginx)
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')

        # 3. Выполняем запрос (передаем управление дальше)
        response = self.get_response(request)

        # 4. Вычисляем время выполнения
        duration = time.time() - start_time

        # 5. Определяем пользователя
        user = request.user
        user_id = getattr(user, 'id', 'Anonymous')
        username = getattr(user, 'username', 'Anonymous')

        # 6. Формируем сообщение для лога
        # Пример: [200] GET /api/admin/ (User: admin, IP: 192.168.1.5) - 0.05s
        log_message = (
            f"[{response.status_code}] {request.method} {request.path} "
            f"(User: {username} [ID:{user_id}], IP: {ip}) - {duration:.3f}s"
        )

        # 7. Логируем в зависимости от статуса
        if response.status_code >= 500:
            # Ошибки сервера - это критично
            security_logger.error(f"SERVER ERROR: {log_message}")
        
        elif response.status_code >= 400:
            # Ошибки доступа (401, 403) или неверные данные (400)
            if response.status_code in [401, 403]:
                security_logger.warning(f"ACCESS DENIED: {log_message}")
            else:
                security_logger.warning(f"CLIENT ERROR: {log_message}")
        
        else:
            # Успешные запросы (только если это изменение данных или вход)
            # Чтобы не засорять лог GET-запросами, можно добавить фильтр,
            # но для диплома лучше писать всё, либо только POST/PUT/DELETE.
            if request.method in ['POST', 'PUT', 'PATCH', 'DELETE'] or 'admin' in request.path:
                security_logger.info(f"ACTION: {log_message}")

        return response