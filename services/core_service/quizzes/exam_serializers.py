"""Strict exam requests and explicitly redacted attempt representations."""
from django.utils import timezone
from rest_framework import serializers
from .serializers import SubmissionIdField, SubmissionUUIDField


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({key: 'Неизвестное поле.' for key in sorted(unknown)})
        return super().to_internal_value(data)


class ExamStartSerializer(StrictSerializer):
    configuration_id = serializers.CharField(max_length=64)
    request_id = SubmissionUUIDField()


class ExamAnswerSerializer(StrictSerializer):
    question_id = SubmissionIdField(min_value=1)
    choice_ids = serializers.ListField(child=SubmissionIdField(min_value=1), allow_empty=True)


class ExamWriteSerializer(StrictSerializer):
    request_id = SubmissionUUIDField()
    revision = SubmissionIdField(min_value=0, max_value=2147483647)
    # The absolute envelope supports the documented full format. The service
    # additionally enforces this attempt's actual size/membership from its snapshot.
    answers = serializers.ListField(child=ExamAnswerSerializer(), allow_empty=True, max_length=130)
    flagged_question_ids = serializers.ListField(child=SubmissionIdField(min_value=1), required=False, allow_empty=True, max_length=130)
    last_question_by_section = serializers.DictField(child=SubmissionIdField(min_value=1), required=False, allow_empty=True)


def result_data(attempt):
    if not attempt.result_id:
        return None
    result = attempt.result
    return {'id': result.pk, 'score': result.score, 'grading': result.scoring_details}


def attempt_summary(attempt):
    return {
        'id': str(attempt.pk), 'status': attempt.status,
        'configuration': attempt.configuration_snapshot,
        'started_at': attempt.started_at, 'deadline': attempt.deadline,
        'completed_at': attempt.completed_at, 'completion_reason': attempt.completion_reason,
        'revision': attempt.revision, 'server_time': timezone.now(),
        'result': result_data(attempt),
    }


def attempt_data(attempt, *, review=False):
    # Never serialize the raw content_snapshot: it contains the server answer key.
    data = attempt_summary(attempt)
    questions = attempt.content_snapshot['questions']
    data['answers'] = [{'question_id': q['id'], 'choice_ids': attempt.answers.get(str(q['id']), [])} for q in questions]
    data['flagged_question_ids'] = attempt.flagged_question_ids
    data['last_question_by_section'] = attempt.last_question_by_section
    data['sections'] = []
    graded = attempt.result.scoring_details['questions'] if review and attempt.result_id else {}
    for section in attempt.configuration_snapshot['sections']:
        public_section = {key: section[key] for key in ('id', 'title', 'response_type', 'question_count', 'max_points')}
        public_section['questions'] = []
        for question in questions:
            if question['section_id'] != section['id']:
                continue
            item = {key: question[key] for key in ('id', 'position', 'number', 'text')}
            item['choices'] = [{'id': choice['id'], 'text': choice['text']} for choice in question['choices']]
            if review:
                points = graded.get(str(question['id']), graded.get(question['id']))
                selected = attempt.answers.get(str(question['id']), [])
                item.update(
                    correct_choice_ids=question['correct_choice_ids'],
                    explanation=question['explanation'], selected_choice_ids=selected,
                    earned_points=points['earned_points'], max_points=points['max_points'],
                    is_correct=points['is_correct'],
                    answer_state=('unanswered' if not selected else 'correct' if points['is_correct'] else
                                  'partial' if points['earned_points'] else 'incorrect'),
                )
            public_section['questions'].append(item)
        data['sections'].append(public_section)
    return data
