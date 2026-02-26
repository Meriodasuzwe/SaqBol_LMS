from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Кастомный бэкенд, который позволяет логиниться как по username, так и по email.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        try:
            # Ищем пользователя: либо логин совпадает, либо email совпадает (используем Q-объекты)
            user = User.objects.get(Q(username=username) | Q(email=username))
        except User.DoesNotExist:
            # Защита от тайминг-атак (чтобы хакеры по времени ответа не поняли, есть ли такой юзер)
            User().set_password(password)
            return None

        # Проверяем пароль и активен ли аккаунт
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
            
        return None