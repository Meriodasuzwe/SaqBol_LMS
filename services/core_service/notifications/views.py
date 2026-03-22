from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """
    GET /notifications/
    Возвращает последние 30 уведомлений текущего пользователя.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)[:30]


class UnreadCountView(APIView):
    """
    GET /notifications/unread-count/
    Возвращает количество непрочитанных уведомлений.
    Фронтенд поллит этот эндпоинт каждые 30 сек для бейджа на колокольчике.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({'unread_count': count})


class MarkAllReadView(APIView):
    """
    PATCH /notifications/mark-read/
    Помечает все уведомления пользователя как прочитанные.
    Вызывается когда пользователь открывает дропдаун.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({'message': 'Все уведомления прочитаны.'})


class MarkOneReadView(APIView):
    """
    PATCH /notifications/<id>/read/
    Помечает одно уведомление как прочитанное.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
            notif.is_read = True
            notif.save()
            return Response({'message': 'Прочитано.'})
        except Notification.DoesNotExist:
            return Response({'error': 'Не найдено.'}, status=404)