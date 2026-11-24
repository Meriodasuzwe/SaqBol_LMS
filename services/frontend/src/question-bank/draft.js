export const newChoice = () => ({id:crypto.randomUUID(),text:'',is_correct:false});
export const newDraft = () => ({subject:'first_subject',topic:'',language:'kk',usage:'exam',text:'',explanation:'',choices:[newChoice(),newChoice()]});
export function selectCorrect(draft, id, checked) {
 return {...draft,choices:draft.choices.map(c=>({...c,is_correct:c.id===id?checked:(draft.subject==='first_subject'?false:c.is_correct)}))};
}
export function payload(draft) {
 const data = Object.fromEntries(['subject','topic','language','usage','text','explanation','choices'].map(k=>[k,draft[k]]));
 if(draft.id) data.revision=draft.revision;
 return data;
}
export function validDraft(d) {
 const correct=d.choices.filter(c=>c.is_correct).length;
 return !!d.topic.trim() && !!d.text.trim() && d.choices.length>=2 && d.choices.length<=8 && d.choices.every(c=>c.text.trim()&&c.text.length<=255) && correct>=1 && correct<=(d.subject==='first_subject'?1:3);
}

export function restoreDraft(storage,key) {
 try {
  const d=JSON.parse(storage.getItem(key));
  if(!d || !['first_subject','second_subject'].includes(d.subject) || !['ru','kk'].includes(d.language) || !['exam','training','both'].includes(d.usage)) return null;
  if(!['topic','text','explanation'].every(k=>typeof d[k]==='string') || !Array.isArray(d.choices) || d.choices.length<2 || d.choices.length>8) return null;
  if(!d.choices.every(c=>c&&typeof c.id==='string'&&typeof c.text==='string'&&typeof c.is_correct==='boolean')) return null;
  if(d.id && (!Number.isInteger(d.id)||!Number.isInteger(d.revision))) return null;
  return d;
 } catch { return null; }
}
export function storeDraft(storage,key,draft,dirty) {
 try { if(dirty)storage.setItem(key,JSON.stringify(draft));else storage.removeItem(key); return true; } catch { return false; }
}

export function creationRequest(draft, pending = null) {
 return pending || {key:crypto.randomUUID(),body:structuredClone(payload(draft))};
}

// Resolve the browser storage inside each call: even access to localStorage can throw.
const browserStorage = name => ({
 getItem: key => globalThis[name].getItem(key),
 setItem: (key,value) => globalThis[name].setItem(key,value),
 removeItem: key => globalThis[name].removeItem(key),
});
export const browserDraftStorage = browserStorage('localStorage');
export const browserSessionStorage = browserStorage('sessionStorage');
