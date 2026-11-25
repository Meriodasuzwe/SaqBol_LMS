"""Real endpoint regressions for stale text-step writes. Synthetic users only."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from courses.models import Category,Course,Lesson,LessonStep
pytestmark=pytest.mark.django_db(transaction=True)

@pytest.fixture
def graph():
 author=get_user_model().objects.create_user(username='artificial_text_author',role='teacher')
 category=Category.objects.create(title='Artificial text version checks')
 course=Course.objects.create(title='Artificial course',category=category,teacher=author)
 lesson=Lesson.objects.create(title='Artificial lesson',course=course)
 step=LessonStep.objects.create(lesson=lesson,title='Original title',step_type='text',content='<p>Original text</p>',scenario_data={})
 client=APIClient();client.force_authenticate(author)
 return client,step

def url(step):return f'/courses/steps/{step.pk}/'
def version(client,step):return client.get(url(step)).data.get('edit_version','0'*64)

def test_text_step_stale_patch_cannot_erase_a_write_after_the_client_get(graph):
 client,step=graph;old=version(client,step)
 first=client.patch(url(step),{'content':'<p>First author update</p>','expected_version':old},format='json')
 assert first.status_code==200
 stale=client.patch(url(step),{'content':'<p>Stale overwrite</p>','expected_version':old},format='json')
 assert stale.status_code==409
 step.refresh_from_db();assert step.content=='<p>First author update</p>'

def test_text_step_get_and_confirmed_patch_return_distinct_versions(graph):
 client,step=graph;old=version(client,step)
 assert old!='0'*64
 response=client.patch(url(step),{'title':'Changed title','expected_version':old},format='json')
 assert response.status_code==200 and response.data['edit_version']!=old
 assert client.get(url(step)).data['edit_version']==response.data['edit_version']

@pytest.mark.parametrize('method',['patch','put'])
def test_text_step_missing_version_does_not_write(graph,method):
 client,step=graph
 response=getattr(client,method)(url(step),{'title':'Overwrite','content':'Unsafe','step_type':'text'},format='json')
 assert response.status_code==428
 step.refresh_from_db();assert step.title=='Original title' and step.content=='<p>Original text</p>'

@pytest.mark.parametrize('value',[None,True,23,'','not-a-version'])
def test_text_step_malformed_version_is_rejected(graph,value):
 client,step=graph
 response=client.patch(url(step),{'content':'Invalid request','expected_version':value},format='json')
 assert response.status_code==400
 step.refresh_from_db();assert step.content=='<p>Original text</p>'

def test_text_step_reordering_needs_no_version_and_keeps_text_token(graph):
 client,step=graph;old=version(client,step)
 assert client.patch(url(step),{'order':9},format='json').status_code==200
 assert version(client,step)==old

def test_other_step_types_preserve_the_existing_patch_contract(graph):
 client,step=graph;step.step_type='video_url';step.save()
 assert client.patch(url(step),{'title':'Existing video update'},format='json').status_code==200

def test_text_step_permissions_are_checked_before_version_conflicts(graph):
 client,step=graph
 other=get_user_model().objects.create_user(username='artificial_text_student',role='student');client.force_authenticate(other)
 assert client.patch(url(step),{'content':'Forbidden','expected_version':'0'*64},format='json').status_code==403
 step.refresh_from_db();assert step.content=='<p>Original text</p>'


@pytest.mark.parametrize('body',[[],['content'],'content',23,True])
def test_text_step_invalid_request_structure_is_a_400_not_a_server_error(graph,body):
 client,step=graph
 response=client.patch(url(step),body,format='json')
 assert response.status_code==400
 step.refresh_from_db();assert step.content=='<p>Original text</p>'
