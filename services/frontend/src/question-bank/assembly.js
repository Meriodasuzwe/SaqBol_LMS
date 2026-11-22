export const limits={first_subject:30,second_subject:20};
export function addQuestions(current,incoming,language){
 const ids=new Set(current.map(q=>q.id)),result=[...current];
 for(const q of incoming){if(ids.has(q.id))continue;if(q.language!==language||!['exam','both'].includes(q.usage))throw new Error('ineligible');result.push(structuredClone(q));ids.add(q.id)}
 for(const [subject,max] of Object.entries(limits))if(result.filter(q=>q.subject===subject).length>max)throw new Error('count');
 return result;
}
export function moveQuestion(items,id,delta){
 const index=items.findIndex(q=>q.id===id);if(index<0)return items;const target=index+delta;
 if(target<0||target>=items.length||items[target].subject!==items[index].subject)return items;
 const copy=[...items];[copy[index],copy[target]]=[copy[target],copy[index]];return copy;
}
export function grouped(items){return ['first_subject','second_subject'].flatMap(s=>items.filter(q=>q.subject===s))}
export function assemblyPayload(title,language,items,requestId){return {title,language,request_id:requestId,questions:grouped(items).map(q=>({id:q.id,revision:q.revision}))}}
export function restoreAssembly(storage,key){try{const x=JSON.parse(storage.getItem(key));if(!x||typeof x.title!=='string'||!['ru','kk'].includes(x.language)||!Array.isArray(x.items)||x.items.length>50||!x.items.every(q=>Number.isInteger(q.id)&&Number.isInteger(q.revision)&&['first_subject','second_subject'].includes(q.subject)&&Array.isArray(q.choices)))return null;return x}catch{return null}}
