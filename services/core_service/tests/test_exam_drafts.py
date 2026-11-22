from copy import deepcopy
from uuid import uuid4
from unittest.mock import patch
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from quizzes.models import BankQuestion,ExamDraft,Quiz,Question,ExamAttempt

pytestmark=pytest.mark.django_db
URL='/quizzes/exam-drafts/'

@pytest.fixture
def graph():
    user=get_user_model().objects.create_user(username='synthetic_assembly_teacher',role='teacher')
    rows=[]
    for i in range(50):
        rows.append(BankQuestion(owner=user,subject='first_subject' if i<30 else 'second_subject',topic='Synthetic topic',language='kk',usage='exam',text=f'Artificial question {i}\nSELECT 1;',explanation='  Artificial explanation\n',choices=[{'id':str(uuid4()),'text':' A\n','is_correct':True},{'id':str(uuid4()),'text':' B\n','is_correct':False}]))
    BankQuestion.objects.bulk_create(rows)
    client=APIClient();client.force_authenticate(user)
    data={'request_id':str(uuid4()),'title':'Synthetic 30+20 set','language':'kk','questions':[{'id':q.pk,'revision':q.revision} for q in rows]}
    return client,user,rows,data


def test_real_assembly_snapshots_exact_order_and_content_without_publication(graph):
    client,user,rows,data=graph
    data['questions'][0],data['questions'][1]=data['questions'][1],data['questions'][0]
    before=[m.objects.count() for m in (Quiz,Question,ExamAttempt)]
    result=client.post(URL,data,format='json');assert result.status_code==201,result.data
    snapshot=result.json()['snapshot'];assert len(snapshot['questions'])==50
    assert [q['source_bank_id'] for q in snapshot['questions']]==[r['id'] for r in data['questions']]
    assert snapshot['questions'][0]['choices']==rows[1].choices
    assert snapshot['questions'][0]['explanation']==rows[1].explanation
    assert [m.objects.count() for m in (Quiz,Question,ExamAttempt)]==before
    old=deepcopy(snapshot)
    BankQuestion.objects.filter(pk=rows[1].pk).update(text='Changed bank only',revision=2)
    assert client.get(URL+str(result.data['id'])+'/').json()['snapshot']==old
    BankQuestion.objects.filter(pk=rows[1].pk).delete()
    assert client.get(URL+str(result.data['id'])+'/').json()['snapshot']==old
    repeated=client.post(URL,data,format='json');assert repeated.status_code==200
    assert repeated.data['id']==result.data['id'] and ExamDraft.objects.count()==1
    assert client.get(URL).json()['results'][0]['status']=='draft'

@pytest.mark.parametrize('case',['49','51','duplicate','subject','language','training','revision','foreign','missing','bad_key','title','unknown','id_type','revision_type'])
def test_invalid_selection_never_creates_partial_draft(graph,case):
    client,user,rows,data=graph
    if case=='49':data['questions'].pop()
    elif case=='51':data['questions'].append(deepcopy(data['questions'][0]))
    elif case=='duplicate':data['questions'][1]=deepcopy(data['questions'][0])
    elif case=='subject':BankQuestion.objects.filter(pk=rows[0].pk).update(subject='second_subject')
    elif case=='language':BankQuestion.objects.filter(pk=rows[0].pk).update(language='ru')
    elif case=='training':BankQuestion.objects.filter(pk=rows[0].pk).update(usage='training')
    elif case=='revision':BankQuestion.objects.filter(pk=rows[0].pk).update(revision=2)
    elif case=='foreign':
        other=get_user_model().objects.create_user(username='synthetic_foreign_author',role='teacher');BankQuestion.objects.filter(pk=rows[0].pk).update(owner=other)
    elif case=='missing':data['questions'][0]['id']=999999
    elif case=='bad_key':BankQuestion.objects.filter(pk=rows[0].pk).update(choices=[{'id':str(uuid4()),'text':'A','is_correct':False},{'id':str(uuid4()),'text':'B','is_correct':False}])
    elif case=='title':data['title']=' '
    elif case=='unknown':data['publish']=True
    elif case=='id_type':data['questions'][0]['id']=str(rows[0].pk)
    elif case=='revision_type':data['questions'][0]['revision']=True
    response=client.post(URL,data,format='json');assert response.status_code==400,response.data
    assert ExamDraft.objects.count()==0
    assert BankQuestion.objects.count()==50


def test_retry_with_changed_payload_rejected_but_explicit_new_set_allowed(graph):
    client,user,rows,data=graph
    first=client.post(URL,data,format='json');assert first.status_code==201
    data['title']='Different title';assert client.post(URL,data,format='json').status_code==400
    assert ExamDraft.objects.count()==1
    data['request_id']=str(uuid4());assert client.post(URL,data,format='json').status_code==201
    assert ExamDraft.objects.count()==2


def test_failed_snapshot_insert_rolls_back(graph):
    client,user,rows,data=graph
    original=ExamDraft.objects.create
    def failed(*a,**kw):
        original(*a,**kw);raise RuntimeError('Injected artificial failure after INSERT')
    with patch.object(ExamDraft.objects,'create',side_effect=failed):
        with pytest.raises(RuntimeError):client.post(URL,data,format='json')
    assert ExamDraft.objects.count()==0
    assert client.post(URL,data,format='json').status_code==201


def test_drafts_are_private_and_students_cannot_read_keys(graph):
    client,user,rows,data=graph
    saved=client.post(URL,data,format='json').json();url=URL+str(saved['id'])+'/'
    other=get_user_model().objects.create_user(username='synthetic_other_assembly_teacher',role='teacher');client.force_authenticate(other)
    assert client.get(URL).json()['count']==0 and client.get(url).status_code==404
    student=get_user_model().objects.create_user(username='synthetic_assembly_student',role='student');client.force_authenticate(student)
    assert client.get(URL).status_code==403 and client.get(url).status_code==403 and client.post(URL,data,format='json').status_code==403
    client.force_authenticate(None);assert client.get(url).status_code in (401,403)
    client.force_authenticate(user);assert client.patch(url,{'title':'Not editable'},format='json').status_code==405


def test_shared_questions_are_eligible_and_filter_excludes_training(graph):
    client,user,rows,data=graph
    BankQuestion.objects.filter(pk=rows[0].pk).update(usage='both')
    assert client.post(URL,data,format='json').status_code==201
    BankQuestion.objects.filter(pk=rows[1].pk).update(usage='training')
    choices=client.get('/quizzes/bank/',{'for_exam':'true'}).json()
    assert choices['count']==49 and all(q['usage'] in ('exam','both') for q in choices['results'])
