// Local recovery for one existing text step. No background writes to the API.
const clone = value => structuredClone(value);
const fields = step => ({title: step.title || '', content: step.content || ''});
const same = (a,b) => a.title === b.title && a.content === b.content;
// DRF CharField strips surrounding whitespace; code whitespace inside HTML is untouched.
const acknowledged = (a,b) => a.title.trim() === b.title.trim() && a.content.trim() === b.content.trim();
const signature = step => JSON.stringify([step.step_type, fields(step), step.scenario_data ?? {}]);
export const textDraftStorage = {
 getItem: key => globalThis.localStorage.getItem(key),
 setItem: (key,value) => globalThis.localStorage.setItem(key,value),
 removeItem: key => globalThis.localStorage.removeItem(key),
};
export function createTextStepRecovery({api,storage=textDraftStorage,courseId,stepId,onStep,onState,onSave}) {
 let disposed=false, key=null, base=null, saved=null;
 let state={phase:'loading',dirty:false,storageError:false,error:null,draft:null};
 const publish=patch=>{state={...state,...patch};if(!disposed)onState({...state})};
 const clear=()=>{try{storage.removeItem(key);return true}catch{return false}};
 const persist=()=>{
  try{if(state.dirty)storage.setItem(key,JSON.stringify({version:1,base,draft:state.draft}));else storage.removeItem(key);return true}catch{return false}
 };
 const validStep=s=>s && Number(s.id)===Number(stepId) && s.step_type==='text' && typeof s.content==='string' && typeof s.title==='string';
 const setServer=s=>{saved=clone(s);base=signature(s);if(!disposed)onStep(clone(s))};
 async function open(){
  publish({phase:'loading',error:null});
  try{
   const [author,response]=await Promise.all([api.get('users/me/'),api.get(`courses/steps/${stepId}/`)]);
   if(disposed)return;
   if(!Number.isInteger(author.data.id)||author.data.id<=0||!/^\d+$/.test(String(courseId))||!validStep(response.data))throw new Error('Invalid recovery identity');
   key=`saqbol.builder.text.${author.data.id}.${courseId}.${stepId}`;
   setServer(response.data);
   let cached=null,storageError=false;
   try{const raw=storage.getItem(key);if(raw){cached=JSON.parse(raw);if(cached.version!==1||typeof cached.base!=='string'||typeof cached.draft?.title!=='string'||typeof cached.draft?.content!=='string')throw new Error('Invalid local draft')}}catch{storageError=true}
   if(cached && !storageError && !acknowledged(cached.draft,fields(saved))){
    publish({phase:cached.base===base?'recover':'conflict',dirty:true,draft:clone(cached.draft),storageError:false});
   }else{
    // A fresh read can confirm a save whose HTTP response was lost.
    if(cached&&!storageError)storageError=!clear();
    publish({phase:'ready',dirty:false,draft:fields(saved),storageError});
   }
  }catch{if(!disposed)publish({phase:'error',error:'load'})}
 }
 function edit(next){
  if(disposed||state.phase!=='ready')return;
  const draft=fields(next);state={...state,draft,dirty:!same(draft,fields(saved)),error:null};
  const stored=persist();onStep({...saved,...draft});publish({storageError:!stored});
 }
 function restore(){
  if(disposed||state.phase!=='recover')return;
  onStep({...saved,...state.draft});publish({phase:'ready',error:null});
 }
 function discard(){
  if(disposed||!['recover','conflict'].includes(state.phase))return;
  const removed=clear();onStep(clone(saved));publish({phase:'ready',draft:fields(saved),dirty:false,storageError:!removed,error:null});
 }
 async function save(){
  if(disposed||state.phase!=='ready'||!key)return;
  publish({phase:'saving',error:null});
  try{
   const response=await api.get(`courses/steps/${stepId}/`);
   if(disposed)return;
   if(!validStep(response.data))throw new Error('Invalid server step');
   if(acknowledged(fields(response.data),state.draft)){
    setServer(response.data);publish({phase:'ready',dirty:false,storageError:!clear()});return;
   }
   if(signature(response.data)!==base){
    setServer(response.data);publish({phase:'conflict',dirty:true,error:null});return;
   }
   if(typeof response.data.edit_version!=='string'||!response.data.edit_version)throw new Error('Server does not support guarded text writes');
   const result=await onSave({expectedVersion:response.data.edit_version});
   if(disposed)return;
   if(!validStep(result)||!acknowledged(fields(result),state.draft))throw new Error('Unconfirmed save');
   setServer(result);publish({phase:'ready',dirty:false,storageError:!clear()});
  }catch(error){if(!disposed)publish(error?.response?.status===409?{phase:'conflict',dirty:true,error:null}:{phase:'ready',error:'save'})}
 }
 return {open,edit,restore,discard,save,dispose(){disposed=true},getState:()=>({...state})};
}
