"""Draft question editing only; never publishes or mutates a live Quiz."""
from uuid import UUID
import hashlib
import json
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers, generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import BankQuestion, BankCreateReceipt
from .bank_topics import TOPICS


def manager(user):
    return user.is_staff or user.is_superuser or getattr(user, 'role', '') == 'admin'


class CanEditBank(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (manager(request.user) or request.user.role == 'teacher')


class BankSerializer(serializers.ModelSerializer):
    revision = serializers.IntegerField(min_value=1, required=False)
    # Text/code is stored exactly; JSON values are validated without coercion.
    text = serializers.CharField(trim_whitespace=False, max_length=50000)
    explanation = serializers.CharField(trim_whitespace=False, allow_blank=True, required=False, max_length=50000)
    choices = serializers.JSONField()

    class Meta:
        model = BankQuestion
        fields = ['id', 'subject', 'topic', 'language', 'usage', 'text', 'explanation', 'choices', 'revision', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise ValidationError({'non_field_errors': ['Ожидается объект JSON.']})
        for name in ('text', 'topic', 'explanation'):
            if name in data and (type(data[name]) is not str or '\x00' in data[name]):
                raise ValidationError({name: ['Нужна строка без нулевых символов.']})
        if 'revision' in data and type(data['revision']) is not int:
            raise ValidationError({'revision': ['Нужна целая версия вопроса.']})
        unknown = set(data) - set(self.fields)
        if unknown:
            raise ValidationError({key: ['Неизвестное поле.'] for key in unknown})
        return super().to_internal_value(data)

    def validate(self, attrs):
        value = lambda name: attrs.get(name, getattr(self.instance, name, None))
        if self.instance is not None:
            if type(attrs.get('revision')) is not int:
                raise ValidationError({'revision': ['Для изменения нужна текущая версия вопроса.']})
            if attrs['revision'] != self.instance.revision:
                raise ValidationError({'revision': ['Вопрос изменён. Обновите список перед редактированием.']})
        elif 'revision' in attrs:
            raise ValidationError({'revision': ['Версию нового вопроса назначает сервер.']})
        if not value('text') or not value('text').strip():
            raise ValidationError({'text': ['Введите текст вопроса.']})
        choices = value('choices')
        if type(choices) is not list or not 2 <= len(choices) <= 8:
            raise ValidationError({'choices': ['Добавьте от 2 до 8 вариантов.']})
        seen = set()
        for index, option in enumerate(choices):
            error = f'Вариант {index + 1}'
            if type(option) is not dict or set(option) != {'id', 'text', 'is_correct'}:
                raise ValidationError({'choices': [error + ': нужны id, text, is_correct.']})
            try:
                if type(option['id']) is not str:
                    raise ValueError()
                key = UUID(option['id'])
            except (ValueError, TypeError, AttributeError):
                raise ValidationError({'choices': [error + ': неверный UUID.']})
            if key in seen:
                raise ValidationError({'choices': [error + ': повтор идентификатора.']})
            seen.add(key)
            if type(option['text']) is not str or not option['text'].strip() or len(option['text']) > 255 or '\x00' in option['text']:
                raise ValidationError({'choices': [error + ': нужен текст от 1 до 255 символов.']})
            if type(option['is_correct']) is not bool:
                raise ValidationError({'choices': [error + ': is_correct должен быть true или false.']})
        count = sum(c['is_correct'] for c in choices)
        limit = 1 if value('subject') == 'first_subject' else 3
        if not 1 <= count <= limit:
            raise ValidationError({'choices': [f'Правильных вариантов должно быть от 1 до {limit}.']})
        return attrs


class BankPagination(PageNumberPagination):
    page_size = 20


class BankAccess:
    permission_classes = [IsAuthenticated, CanEditBank]
    serializer_class = BankSerializer

    def get_queryset(self):
        query = BankQuestion.objects.all() if manager(self.request.user) else BankQuestion.objects.filter(owner=self.request.user)
        return query.order_by('-updated_at', '-id')


class BankList(BankAccess, generics.ListCreateAPIView):
    pagination_class = BankPagination

    def get_queryset(self):
        query = super().get_queryset()
        for field in ('subject', 'usage', 'language'):
            if self.request.query_params.get(field):
                query = query.filter(**{field: self.request.query_params[field]})
        if self.request.query_params.get('for_training') == 'true':
            query = query.filter(usage__in=['training', 'both'])
        if self.request.query_params.get('for_exam') == 'true':
            query = query.filter(usage__in=['exam', 'both'])
        if self.request.query_params.get('topic'):
            query = query.filter(topic=self.request.query_params['topic'])
        search = self.request.query_params.get('search', '')[:255].strip()
        if search:
            query = query.filter(Q(text__icontains=search) | Q(topic__icontains=search))
        return query

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        key = request.headers.get('Idempotency-Key')
        if key is None:
            # Keep existing clients' correct requests compatible.
            return super().create(request, *args, **kwargs)
        try:
            request_id = UUID(key)
        except (ValueError, TypeError, AttributeError):
            raise ValidationError({'request_id': ['Нужен UUID в Idempotency-Key.']})
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        digest = hashlib.sha256(json.dumps(serializer.validated_data, ensure_ascii=False,
                                          sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        # Lock order is shared with exam-draft creation: author, then content.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        receipt = BankCreateReceipt.objects.filter(owner=request.user, request_id=request_id).first()
        if receipt:
            if receipt.fingerprint != digest:
                raise ValidationError({'request_id': ['Этот запрос уже сохранён с другим содержимым.']})
            return Response(receipt.response, status=200)
        self.perform_create(serializer)
        data = dict(serializer.data)
        BankCreateReceipt.objects.create(owner=request.user, request_id=request_id,
                                         fingerprint=digest, response=data)
        return Response(data, status=201)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class BankDetail(BankAccess, generics.RetrieveUpdateAPIView):
    # No hard-delete or publication endpoint in this stage.
    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            instance = self.get_queryset().select_for_update().get(pk=self.get_object().pk)
            serializer = self.get_serializer(instance, data=request.data, partial=kwargs.get('partial', False))
            serializer.is_valid(raise_exception=True)
            serializer.save(revision=instance.revision + 1)
            return Response(serializer.data)


class BankMetadata(APIView):
    permission_classes = [IsAuthenticated, CanEditBank]

    def get(self, request):
        return Response({'topics': TOPICS, 'author_id': request.user.pk})
