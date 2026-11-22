from copy import deepcopy
from uuid import uuid4
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from quizzes.models import BankQuestion, Quiz, Question, Result, ExamAttempt

pytestmark = pytest.mark.django_db
URL = '/quizzes/bank/'

@pytest.fixture
def author():
    return get_user_model().objects.create_user(username='synthetic_bank_author', role='teacher')

@pytest.fixture
def client(author):
    c=APIClient(); c.force_authenticate(author); return c

@pytest.fixture
def body():
    return {'subject':'first_subject','topic':'Сортировка','language':'kk','usage':'exam',
            'text':'Artificial question\n\n```sql\nSELECT 1;\n```','explanation':'Artificial explanation\n  preserved',
            'choices':[{'id':str(uuid4()),'text':' One \n  exact','is_correct':True},
                       {'id':str(uuid4()),'text':'Two','is_correct':False}]}

def test_real_bank_create_read_edit_filters_and_no_live_quiz_mutation(client, body):
    counts=[m.objects.count() for m in (Quiz,Question,Result,ExamAttempt)]
    response=client.post(URL,body,format='json')
    assert response.status_code==201, response.data
    saved=response.json(); assert saved['revision']==1
    for key in body: assert saved[key]==body[key]
    assert client.get(URL+str(saved['id'])+'/').json()==saved
    edited=client.put(URL+str(saved['id'])+'/',{**body,'topic':'Поиск','revision':1},format='json')
    assert edited.status_code==200 and edited.data['revision']==2
    assert client.get(URL,{'search':'Поиск','subject':'first_subject','usage':'exam','language':'kk'}).data['count']==1
    assert client.get(URL,{'usage':'training'}).data['count']==0
    assert [m.objects.count() for m in (Quiz,Question,Result,ExamAttempt)]==counts

def test_stale_or_missing_revision_cannot_overwrite(client,body):
    saved=client.post(URL,body,format='json').json(); url=URL+str(saved['id'])+'/'
    assert client.patch(url,{'revision':1,'topic':'New'},format='json').status_code==200
    before=list(BankQuestion.objects.values())
    for change in ({'revision':1,'topic':'Stale'},{'topic':'Missing'},{'revision':True,'topic':'Boolean'}):
        assert client.patch(url,change,format='json').status_code==400
        assert list(BankQuestion.objects.values())==before

@pytest.mark.parametrize('field,value', [('topic',''),('topic','x'*256),('topic',None),('text',' '),('text',12),('text','bad\x00text'),('language','en'),('subject','unknown'),('usage','unknown'),('owner',1),('difficulty','A'),('revision',1)])
def test_invalid_fields_do_not_write(client,body,field,value):
    body[field]=value
    assert client.post(URL,body,format='json').status_code==400
    assert BankQuestion.objects.count()==0

@pytest.mark.parametrize('case',['empty','one','nine','no_key','two_keys','duplicate','bool_string','bad_id','extra','long','nul'])
def test_invalid_options_do_not_write(client,body,case):
    if case=='empty': body['choices']=[]
    elif case=='one': body['choices']=body['choices'][:1]
    elif case=='nine': body['choices']=[{'id':str(uuid4()),'text':'X','is_correct':i==0} for i in range(9)]
    elif case=='no_key': body['choices'][0]['is_correct']=False
    elif case=='two_keys': body['choices'][1]['is_correct']=True
    elif case=='duplicate': body['choices'][1]['id']=body['choices'][0]['id']
    elif case=='bool_string': body['choices'][0]['is_correct']='true'
    elif case=='bad_id': body['choices'][0]['id']='bad'
    elif case=='extra': body['choices'][0]['score']=2
    elif case=='long': body['choices'][0]['text']='x'*256
    elif case=='nul': body['choices'][0]['text']='bad\x00text'
    assert client.post(URL,body,format='json').status_code==400
    assert BankQuestion.objects.count()==0

@pytest.mark.parametrize('correct',[1,2,3])
def test_multiple_keys_preserved(client,body,correct):
    body['subject']='second_subject'
    body['choices']=[{'id':str(uuid4()),'text':str(i),'is_correct':i<correct} for i in range(6)]
    saved=client.post(URL,body,format='json')
    assert saved.status_code==201
    assert saved.data['choices']==body['choices']

def test_four_correct_second_subject_rejected(client,body):
    body['subject']='second_subject';body['choices']=[{'id':str(uuid4()),'text':str(i),'is_correct':True} for i in range(4)]
    assert client.post(URL,body,format='json').status_code==400

@pytest.mark.parametrize('role',['student','corporate_admin'])
def test_non_authors_cannot_read_keys_or_write(author,body,role):
    c=APIClient();c.force_authenticate(author);saved=c.post(URL,body,format='json').json()
    student=get_user_model().objects.create_user(username='synthetic_bank_'+role,role=role)
    c.force_authenticate(student)
    for path in (URL,URL+'topics/',URL+str(saved['id'])+'/'):
        assert c.get(path).status_code==403
    assert c.post(URL,body,format='json').status_code==403
    assert c.patch(URL+str(saved['id'])+'/',{'revision':1,'topic':'Bad'},format='json').status_code==403
    assert BankQuestion.objects.get(pk=saved['id']).topic==body['topic']

def test_teacher_cannot_access_other_teacher_draft(client,body):
    saved=client.post(URL,body,format='json').json()
    other=get_user_model().objects.create_user(username='synthetic_bank_other',role='teacher')
    client.force_authenticate(other)
    assert client.get(URL).data['count']==0
    assert client.get(URL+str(saved['id'])+'/').status_code==404
    assert client.patch(URL+str(saved['id'])+'/',{'revision':1,'topic':'Bad'},format='json').status_code==404
    other.is_staff=True;other.save(update_fields=['is_staff'])
    assert client.get(URL).data['count']==1


def test_anonymous_cannot_read_bank(client,body):
    client.post(URL,body,format='json');client.force_authenticate(None)
    assert client.get(URL).status_code in (401,403)

def test_topics_and_pagination(client,body,author):
    metadata=client.get(URL+'topics/').json()
    assert metadata['author_id']==author.pk
    topics=metadata['topics']
    assert len(topics['first_subject'])==10 and len(topics['second_subject'])==16
    for _ in range(21): assert client.post(URL,body,format='json').status_code==201
    first=client.get(URL).json(); second=client.get(URL,{'page':2}).json()
    assert first['count']==21 and len(first['results'])==20 and len(second['results'])==1
    assert first['next'] and second['previous']


def test_training_picker_includes_shared_but_excludes_exam_and_filters_topic(client,body):
    for usage in ('exam','training','both'):
        assert client.post(URL,{**body,'usage':usage},format='json').status_code==201
    result=client.get(URL,{'for_training':'true','topic':body['topic']}).json()
    assert result['count']==2
    assert {q['usage'] for q in result['results']}=={'training','both'}
    assert client.get(URL,{'for_training':'true','topic':'Unknown topic'}).json()['count']==0


def test_bank_copy_to_actual_builder_save_is_independent_and_preserves_metadata(client,author,body):
    from courses.models import Category,Course,Lesson,LessonStep
    from quizzes.models import Choice
    body['usage']='both';body['subject']='second_subject'
    body['text']='  Artificial bank text\n\nSELECT 1;  '
    body['explanation']='  Artificial explanation\n  '
    saved=client.post(URL,body,format='json').json()
    course=Course.objects.create(title='Synthetic bank copy',teacher=author,category=Category.objects.create(title='Synthetic copy'))
    lesson=Lesson.objects.create(course=course,title='Synthetic copy lesson')
    step=LessonStep.objects.create(lesson=lesson,title='Synthetic test',step_type='quiz',scenario_data={})
    content={'question':saved['text'],'topic':saved['topic'],'kt_subject':saved['subject'],
             'explanation':saved['explanation'],'options':[c['text'] for c in saved['choices']],
             'correct_index':[i for i,c in enumerate(saved['choices']) if c['is_correct']]}
    response=client.post('/quizzes/save-generated/',{'lesson_id':lesson.pk,'step_id':step.pk,
        'step':{'title':'Synthetic test','step_type':'quiz','content':'','scenario_data':{}},'questions':[content]},format='json')
    assert response.status_code==201,response.data
    quiz_id=response.data['quiz_id'];question=Question.objects.get(quiz_id=quiz_id)
    assert question.text==body['text'] and question.explanation==body['explanation']
    assert question.topic==body['topic'] and question.kt_subject==body['subject']
    assert list(question.choices.order_by('id').values_list('text','is_correct'))==[(c['text'],c['is_correct']) for c in body['choices']]
    assert client.patch(URL+str(saved['id'])+'/',{'revision':1,'text':'Changed only in bank'},format='json').status_code==200
    question.refresh_from_db();assert question.text==body['text']
    loaded=client.get('/quizzes/'+str(quiz_id)+'/').json()['questions'][0]
    assert loaded['topic']==body['topic'] and loaded['kt_subject']==body['subject']
    question.text='Changed only in course';question.save(update_fields=['text'])
    assert BankQuestion.objects.get(pk=saved['id']).text=='Changed only in bank'
