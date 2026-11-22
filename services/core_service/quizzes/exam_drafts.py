"""Manual draft assembly. No publication, Quiz writes or lifecycle calls."""
from copy import deepcopy
from uuid import UUID
import hashlib
import json
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import BankQuestion, ExamDraft
from .question_bank import CanEditBank, BankSerializer, BankPagination, manager
from .grading import calculate_kt_profile_score


def visible(user):
    return ExamDraft.objects.all() if manager(user) else ExamDraft.objects.filter(owner=user)


def summary(draft):
    return {'id':draft.pk,'title':draft.title,'language':draft.language,'created_at':draft.created_at.isoformat(),'status':'draft'}


def detail(draft):
    return {**summary(draft),'snapshot':draft.snapshot}


def validate_request(data):
    if type(data) is not dict or set(data)!={'request_id','title','language','questions'}:
        raise ValidationError({'detail':'Нужны request_id, title, language, questions.'})
    try:
        if type(data['request_id']) is not str: raise ValueError()
        UUID(data['request_id'])
    except (ValueError,TypeError):
        raise ValidationError({'request_id':'Нужен UUID запроса.'})
    if type(data['title']) is not str or not data['title'].strip() or len(data['title'])>255 or '\x00' in data['title']:
        raise ValidationError({'title':'Введите название до 255 символов.'})
    if data['language'] not in ('ru','kk'):
        raise ValidationError({'language':'Выберите ru или kk.'})
    refs=data['questions']
    if type(refs) is not list or len(refs)!=50:
        raise ValidationError({'questions':'Нужны ровно 30 вопросов АиСД и 20 вопросов БД.'})
    seen=set()
    for index,ref in enumerate(refs):
        if type(ref) is not dict or set(ref)!={'id','revision'} or any(type(ref[k]) is not int or ref[k]<1 for k in ('id','revision')):
            raise ValidationError({'questions':f'Позиция {index+1}: нужны целые положительные id и revision.'})
        if ref['id'] in seen:
            raise ValidationError({'questions':f'Позиция {index+1}: вопрос выбран повторно.'})
        seen.add(ref['id'])
    return data


@transaction.atomic
def assemble(user,data):
    data=validate_request(data)
    canonical={**data,'request_id':str(UUID(data['request_id']))}
    digest=hashlib.sha256(json.dumps(canonical,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    # Serialize retries of one author's creation, including simultaneous requests.
    get_user_model().objects.select_for_update().get(pk=user.pk)
    old=ExamDraft.objects.filter(owner=user,request_id=data['request_id']).first()
    if old:
        if old.fingerprint!=digest:
            raise ValidationError({'request_id':'Этот запрос уже сохранён с другим содержимым.'})
        return old,False
    query=BankQuestion.objects.all() if manager(user) else BankQuestion.objects.filter(owner=user)
    rows={q.pk:q for q in query.select_for_update().filter(pk__in=[q['id'] for q in data['questions']]).order_by('pk')}
    frozen=[]
    keys={'first_subject':{},'second_subject':{}}
    next_choice=1
    for index,ref in enumerate(data['questions']):
        q=rows.get(ref['id']); label=f'Позиция {index+1}'
        if q is None: raise ValidationError({'questions':label+': вопрос отсутствует или недоступен.'})
        if q.revision!=ref['revision']: raise ValidationError({'questions':label+': вопрос изменён в банке. Выберите его заново.'})
        expected='first_subject' if index<30 else 'second_subject'
        if q.subject!=expected: raise ValidationError({'questions':label+': сначала нужны 30 вопросов АиСД, затем 20 БД.'})
        if q.usage not in ('exam','both'): raise ValidationError({'questions':label+': вопрос предназначен только для тренировок.'})
        if q.language!=data['language']: raise ValidationError({'questions':label+': язык не совпадает с языком комплекта.'})
        # Revalidate even records changed directly through ORM/admin.
        check=BankSerializer(data={k:getattr(q,k) for k in ('subject','topic','language','usage','text','explanation','choices')})
        if not check.is_valid(): raise ValidationError({'questions':label+': исправьте вопрос в банке.', 'fields':check.errors})
        key={}
        for choice in q.choices:
            key[next_choice]=choice['is_correct'];next_choice+=1
        keys[q.subject][index+1]=key
        frozen.append({'source_bank_id':q.pk,'source_revision':q.revision,'subject':q.subject,'topic':q.topic,'text':q.text,'explanation':q.explanation,'choices':deepcopy(q.choices)})
    try:
        calculate_kt_profile_score(keys['first_subject'],keys['second_subject'],[])
    except ValueError as error:
        raise ValidationError({'questions':str(error)})
    snapshot={'version':1,'program':'M094','language':data['language'],'questions':frozen}
    return ExamDraft.objects.create(owner=user,request_id=data['request_id'],fingerprint=digest,title=data['title'],language=data['language'],snapshot=snapshot),True


class ExamDraftList(APIView):
    permission_classes=[IsAuthenticated,CanEditBank]

    def get(self,request):
        paginator=BankPagination()
        rows=paginator.paginate_queryset(visible(request.user).order_by('-id'),request,view=self)
        return paginator.get_paginated_response([summary(row) for row in rows])

    def post(self,request):
        draft,created=assemble(request.user,request.data)
        return Response(detail(draft),status=201 if created else 200)


class ExamDraftDetail(APIView):
    permission_classes=[IsAuthenticated,CanEditBank]

    def get(self,request,pk):
        return Response(detail(get_object_or_404(visible(request.user),pk=pk)))
