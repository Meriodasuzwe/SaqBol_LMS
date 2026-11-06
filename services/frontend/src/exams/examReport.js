// Only public identifiers belong in a question report. Never serialize an attempt.
export function buildExamReportContext(context = {}) {
  context = context && typeof context === 'object' ? context : {};
  const safe = {};
  if (typeof context.attempt_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.attempt_id)) {
    safe.attempt_id = context.attempt_id;
  }
  if (typeof context.section_id === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(context.section_id)) {
    safe.section_id = context.section_id;
  }
  if (Number.isSafeInteger(context.question_id) && context.question_id > 0) safe.question_id = context.question_id;
  const path = typeof context.path === 'string' ? context.path.split(/[?#]/)[0] : '/exams';
  safe.path = /^\/exams(?:\/[a-zA-Z0-9/_-]*)?$/.test(path) ? path : '/exams';
  return safe;
}

export function reportDescription(description, context) {
  if (!context) return description.trim();
  return `${description.trim()}\n\nExam context: ${JSON.stringify(buildExamReportContext(context))}`;
}

// Same endpoint and multipart contract as the existing floating bug report.
export async function submitBugReport(client, form, screenshots = [], context) {
  const data = new FormData();
  data.append('title', form.title.trim());
  data.append('category', form.category);
  data.append('description', reportDescription(form.description, context));
  data.append('page_url', form.page_url);
  screenshots.forEach(screenshot => data.append('screenshots', screenshot.file));
  return client.post('/bugs/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
}
