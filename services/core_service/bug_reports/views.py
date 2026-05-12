from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.throttling import AnonRateThrottle
from django.shortcuts import get_object_or_404

from .models import BugReport, BugReportScreenshot
from .serializers import BugReportSerializer


class BugReportThrottle(AnonRateThrottle):
    # Максимум 5 репортов в час с одного IP
    scope = 'bug_reports'


class BugReportCreateView(APIView):
    """
    POST /api/bugs/
    Принимает multipart/form-data:
      - title, category, description, page_url
      - screenshots[] — до 5 файлов изображений
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [BugReportThrottle]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = BugReportSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        report = serializer.save()

        # Сохраняем скриншоты (до 5 штук)
        screenshots = request.FILES.getlist('screenshots')
        for img in screenshots[:5]:
            BugReportScreenshot.objects.create(report=report, image=img)

        return Response(
            BugReportSerializer(report, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class BugReportListView(generics.ListAPIView):
    """GET /api/bugs/ — только для администраторов"""
    serializer_class = BugReportSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = BugReport.objects.prefetch_related('screenshots')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class BugReportDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PATCH/DELETE /api/bugs/<id>/ — только для администраторов"""
    serializer_class = BugReportSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = BugReport.objects.prefetch_related('screenshots')

    def patch(self, request, *args, **kwargs):
        report = self.get_object()
        allowed_fields = {'status', 'admin_note'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = BugReportSerializer(report, data=data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)