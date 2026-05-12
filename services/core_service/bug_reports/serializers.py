from rest_framework import serializers
from .models import BugReport, BugReportScreenshot


class BugReportScreenshotSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = BugReportScreenshot
        fields = ['id', 'image_url', 'uploaded_at']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class BugReportSerializer(serializers.ModelSerializer):
    screenshots = BugReportScreenshotSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = BugReport
        fields = [
            'id', 'title', 'category', 'category_display',
            'description', 'page_url', 'status', 'status_display',
            'admin_note', 'created_at', 'updated_at', 'screenshots'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']