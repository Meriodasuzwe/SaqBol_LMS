"""Authenticated exam lifecycle API; legacy lesson quiz routes stay unchanged."""
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from .models import ExamAttempt
from . import exam_services
from .exam_serializers import ExamStartSerializer, ExamWriteSerializer, attempt_data, attempt_summary, result_data


class ExamView(APIView):
    permission_classes = [IsAuthenticated]


class ExamConfigurationsView(ExamView):
    def get(self, request):
        return Response(exam_services.list_configurations(request.user))


class ExamAttemptsView(ExamView):
    def get(self, request):
        wanted_status = request.query_params.get('status')
        if wanted_status not in (None, 'active', 'completed'):
            raise ValidationError({'status': 'Допустимые состояния: active, completed.'})
        offset = serializers.IntegerField(min_value=0, max_value=2147483647).run_validation(request.query_params.get('offset', 0))
        queryset = ExamAttempt.objects.filter(student=request.user).order_by('-started_at', '-pk')
        configuration = request.query_params.get('configuration_id')
        if configuration:
            queryset = queryset.filter(configuration_key=configuration)
        # Filter by effective state before paging: a resumable attempt must not
        # disappear behind a page of more recent completed attempts.
        now = timezone.now()
        if wanted_status == 'active':
            queryset = queryset.filter(status='active').filter(Q(deadline__isnull=True) | Q(deadline__gt=now))
        elif wanted_status == 'completed':
            queryset = queryset.filter(Q(status='completed') | Q(status='active', deadline__lte=now))
        ids = list(queryset.values_list('pk', flat=True)[offset:offset + 51])
        items = []
        for pk in ids[:50]:
            attempt = exam_services.read_attempt(request.user, pk)
            if wanted_status is None or attempt.status == wanted_status:
                items.append(attempt_summary(attempt))
        return Response({'results': items, 'next_offset': offset + 50 if len(ids) > 50 else None})

    def post(self, request):
        serializer = ExamStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt, created, error = exam_services.start_attempt(request.user, serializer.validated_data)
        if error:
            return Response(error, status=409)
        return Response(attempt_data(attempt), status=201 if created else 200)


class ExamAttemptView(ExamView):
    def get(self, request, attempt_id):
        return Response(attempt_data(exam_services.read_attempt(request.user, attempt_id)))


class ExamAnswersView(ExamView):
    def patch(self, request, attempt_id):
        serializer = ExamWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt, error = exam_services.save_attempt(request.user, attempt_id, serializer.validated_data)
        if error:
            return Response(error, status=409)
        return Response(attempt_data(attempt))


class ExamFinishView(ExamView):
    def post(self, request, attempt_id):
        serializer = ExamWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt, error = exam_services.finish_attempt(request.user, attempt_id, serializer.validated_data)
        if error:
            return Response(error, status=409)
        return Response(attempt_data(attempt))


class ExamResultView(ExamView):
    def get(self, request, attempt_id):
        attempt = exam_services.read_attempt(request.user, attempt_id)
        if attempt.status != ExamAttempt.Status.COMPLETED:
            return Response({'code': 'attempt_active', 'detail': 'Попытка ещё не завершена.'}, status=409)
        return Response({
            'attempt_id': str(attempt.pk), 'configuration': attempt.configuration_snapshot,
            'completed_at': attempt.completed_at, 'completion_reason': attempt.completion_reason,
            'result': result_data(attempt),
        })


class ExamReviewView(ExamView):
    def get(self, request, attempt_id):
        attempt = exam_services.read_attempt(request.user, attempt_id)
        if attempt.status != ExamAttempt.Status.COMPLETED:
            return Response({'code': 'attempt_active', 'detail': 'Разбор доступен после завершения.'}, status=409)
        return Response(attempt_data(attempt, review=True))
