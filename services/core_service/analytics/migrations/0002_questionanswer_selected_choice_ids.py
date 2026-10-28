from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def preserve_legacy_selection(apps, schema_editor):
    Answer = apps.get_model('analytics', 'QuestionAnswer')
    answers = Answer.objects.using(schema_editor.connection.alias)
    for answer in answers.only('pk', 'selected_choice_id').iterator(chunk_size=500):
        # A missing old FK may be a skip or a deleted choice; no ID can be reconstructed.
        selected = [] if answer.selected_choice_id is None else [answer.selected_choice_id]
        answers.filter(pk=answer.pk).update(selected_choice_ids=selected)


def refuse_lossy_reverse(apps, schema_editor):
    Answer = apps.get_model('analytics', 'QuestionAnswer')
    answers = Answer.objects.using(schema_editor.connection.alias)
    for answer in answers.only('selected_choice_id', 'selected_choice_ids').iterator(chunk_size=500):
        legacy = [] if answer.selected_choice_id is None else [answer.selected_choice_id]
        if answer.selected_choice_ids != legacy:
            raise IrreversibleError('Cannot remove complete selections: rollback would discard stored answer IDs.')


class Migration(migrations.Migration):
    dependencies = [('analytics', '0001_initial')]

    operations = [
        migrations.AddField(
            model_name='questionanswer', name='selected_choice_ids',
            field=models.JSONField(default=list, blank=True, verbose_name='Выбранные варианты'),
        ),
        migrations.RunPython(preserve_legacy_selection, refuse_lossy_reverse),
    ]
