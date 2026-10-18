import { canAcknowledge, openYouTube } from './lib/inbox.js';
import { captureYouTube, selectedRoom, composeDraft } from './lib/compose.js';
import { DEFAULT_SERVER } from './lib/config.js';
import { qrDataUrl } from './lib/qr.js';
import { startPairing, parsePairing, approveDevice, receiveDevice, cancelPairing, restoreSnapshot, validateSnapshot } from './lib/pairing.js';
import { storage, isExtension, update } from './lib/storage.js';
import { backendOrigin, displayName, youtubeVideo, parseInvite, invitationLink } from './lib/validation.js';
import { fingerprint, encryptBackup, decryptBackup } from './lib/crypto.js';
import { client, connect, listRooms, createRoom, inviteRoom, joinRoom, approvePeer, getMessages, sendVideo, flushOutbox } from './lib/client.js';

const $=id=>document.getElementById(id);
const state={ctx:null,rooms:[],selected:null,messages:[],hasMore:false,currentVideo:null,refreshing:false,refreshAgain:false,view:'share',feedLayout:'cards',loading:false,offline:false};
const isPopup=location.pathname.endsWith('/popup.html');
if(isPopup)document.body.classList.add('popup');
function el(tag,className,text) {const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);$('notice').hidden=!text;}
function modal(title){$('modal-content').replaceChildren();$('modal-content').append(el('h2',null,title));if(!$('modal').open)$('modal').showModal();return $('modal-content');}
function button(text,handler,style='primary'){const b=el('button',`button ${style}`,text);b.type='button';b.onclick=()=>task(b,handler);return b;}
async function task(target,handler){if(target.disabled)return;target.disabled=true;try{await handler();}catch(error){notice(error.message,true);}finally{target.disabled=false;}}
function paragraph(parent,text){const p=el('p',null,text);parent.append(p);return p;}
function labelInput(form,label,type='text',placeholder=''){const id=crypto.randomUUID();const l=el('label',null,label);l.htmlFor=id;const input=el('input');input.id=id;input.type=type;input.placeholder=placeholder;form.append(l,input);return input;}
function formSubmit(form,label,handler){const b=el('button','button primary full',label);b.type='submit';form.append(b);form.onsubmit=e=>{e.preventDefault();task(b,handler);};return b;}
function room(){return state.rooms.find(r=>r.id===state.selected);}
async function grantServer(server){if(isExtension){const origin=new URL(server);const pattern=`${origin.protocol}//${origin.hostname}/*`;const allowed=await chrome.permissions.request({origins:[pattern]});if(!allowed)throw new Error('Server access was not granted. QuickSend needs access only to your chosen backend.');}}
$('close-modal').onclick=()=>$('modal').close();
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const rect=$('modal').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('modal').close();}});

$('connect-form').onsubmit=event=>{event.preventDefault();const target=event.submitter;task(target,async()=>{
  const server=backendOrigin($('server-url').value);await grantServer(server);
  await connect(server,$('display-name').value);await boot();notice('Your private space is ready. Create a room or join your friend.');
});};
function newRoom(){if(!state.ctx){notice('Connect your private space first.');return;}
  const body=modal('Make a little room.');paragraph(body,'A private shelf for you and one other person. Give it a name that feels like you.');
  const form=el('form'),name=labelInput(form,'Room name','text','e.g. The rabbit hole');name.required=true;name.maxLength=60;
  formSubmit(form,'Create room ↗',async()=>{const created=await createRoom(name.value);state.selected=created.id;await storage.set('selectedRoom',created.id);$('modal').close();await refresh();await showInvite(room());});body.append(form);name.focus();
}
for(const id of ['new-room','empty-create','create-top','quick-create'])$(id).onclick=newRoom;
function joinDialog(){if(!state.ctx){notice('Connect your private space first.');return;}
  const body=modal('Meet you inside.');paragraph(body,'Paste the invitation your friend sent you. They will approve your device before you can share.');
  const form=el('form'),label=el('label',null,'Invitation link or code'),input=el('textarea');input.placeholder='Invitation link or qs1.…';input.required=true;input.maxLength=2000;label.htmlFor='invite-input';input.id='invite-input';form.append(label,input);
  formSubmit(form,'Request to join ↗',async()=>{parseInvite(input.value);const response=await joinRoom(input.value);state.selected=response.roomId;await storage.set('selectedRoom',response.roomId);$('modal').close();await refresh();notice('Request sent. Compare your device fingerprint with your friend, then ask them to approve you.');});body.append(form);input.focus();
}
$('join-room').onclick=joinDialog;
$('quick-join').onclick=joinDialog;
async function showInvite(value){if(!value)return;
  const invitation=await inviteRoom(value.id);const body=modal('Good company, invited.');
  paragraph(body,`Send this link privately to your friend. It works once and expires at ${new Date(invitation.expiresAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}. You still approve who joins.`);
  const link=invitationLink(invitation.code);
  const qr=el('img','invite-qr');qr.src=qrDataUrl(link);qr.alt='Scan to open this private invitation';body.append(qr);
  const input=el('textarea');input.readOnly=true;input.value=link;input.setAttribute('aria-label','Invitation code');body.append(input);
  body.append(button('Copy invitation ↗',async()=>{await navigator.clipboard.writeText(link);notice('Invitation copied. Send it privately to your friend.');}));
  const actions=el('div','modal-actions');actions.append(button('Revoke invitation',async()=>{await state.ctx.api.request(`/rooms/${value.id}/invites`,{method:'DELETE'});$('modal').close();notice('Invitation revoked.');},'secondary'));body.append(actions);
}
function renderRooms(){
  $('rooms').replaceChildren();
  $('quick-room').replaceChildren();
  for(const value of state.rooms){const option=el('option',null,value.name);option.value=value.id;$('quick-room').append(option);}
  $('quick-room').value=state.selected||'';
  $('quick-room').hidden=state.rooms.length<=1;
  $('quick-room-name').hidden=state.rooms.length>1;
  $('quick-room-name').textContent=room()?.name||'';
  $('quick-destination').querySelector('label').textContent=state.view==='inbox'?'Room':'To';
  const unread=state.rooms.reduce((sum,value)=>sum+(value.unread||0),0);
  $('quick-unread').textContent=unread?String(Math.min(unread,99)):'';$('quick-unread').hidden=!unread;
  $('quick-inbox').setAttribute('aria-label',unread?`Inbox, ${unread} unread`:'Inbox');
  $('quick-destination').hidden=!state.rooms.length;
  $('quick-empty').hidden=Boolean(state.rooms.length);
  for(const value of state.rooms){const b=el('button',`room-button${value.id===state.selected?' selected':''}`);b.type='button';b.setAttribute('aria-pressed',String(value.id===state.selected));
    const a=el('span','room-avatar',(value.name||'Room').slice(0,2).toUpperCase());const info=el('span','room-label');info.append(el('strong',null,value.name||'Unverified room'),el('small',null,value.keyError?'Needs attention':value.status==='pending'?'Waiting for approval':value.peer?.status==='active'?`With ${value.peer.name}`:value.peer?'Join request received':'Waiting for your person'));
    b.append(a,info);if(value.unread)b.append(el('span','unread',value.unread));b.onclick=()=>selectRoom(value.id).catch(error=>notice(error.message,true));$('rooms').append(b);
  }
  if(!state.rooms.length)$('rooms').append(el('p','room-skeleton','Your first room is a good place to start.'));
}
async function selectRoom(id){
  $('feed').scrollTop=0;state.selected=id;state.messages=[];state.hasMore=false;state.loading=readsInbox();renderFeed();
  await storage.set('selectedRoom',id);await refresh(true);
}
$('quick-room').onchange=()=>selectRoom($('quick-room').value).catch(error=>notice(error.message,true));
function readsInbox(){return !isPopup||state.view==='inbox';}
function renderView(){
  document.body.classList.toggle('show-inbox',isPopup&&state.view==='inbox');
  $('quick-share').setAttribute('aria-pressed',String(state.view==='share'));
  $('quick-inbox').setAttribute('aria-pressed',String(state.view==='inbox'));
  $('quick-hint').textContent=state.offline?(state.view==='inbox'?'Offline · showing cached videos':'Offline · shares will queue'):(state.view==='inbox'?'Videos open in this browser':'⌘ / Ctrl + Enter to send');
  const list=isPopup||state.feedLayout==='list';$('feed').classList.toggle('feed-list',list);
  $('view-cards').setAttribute('aria-pressed',String(!list));$('view-list').setAttribute('aria-pressed',String(list));
}
async function showPopupView(view){
  if(!state.ctx)return;
  state.view=view;notice('');renderView();renderRooms();
  if(view==='inbox'){state.loading=true;renderFeed();await refresh();}else{state.loading=false;renderFeed();if(!$('compose').hidden)$('video-note').focus();}
}
$('quick-share').onclick=()=>task($('quick-share'),()=>showPopupView('share'));
$('quick-inbox').onclick=()=>task($('quick-inbox'),()=>showPopupView('inbox'));
for(const layout of ['cards','list'])$('view-'+layout).onclick=()=>task($('view-'+layout),async()=>{state.feedLayout=layout;renderView();await storage.set('feedLayout',layout);});
function renderPairing(value){const area=$('pairing');area.replaceChildren();area.hidden=true;if(!value)return;
  if(value.keyError){area.hidden=false;area.append(el('h2',null,'Let’s check this connection.'),el('p',null,value.keyError));return;}
  if(value.status==='pending'){area.hidden=false;area.append(el('h2',null,'Your seat is saved.'),el('p',null,'Your friend needs to approve this device. Share your fingerprint with them using a channel you already trust.'));area.append(button('Show my fingerprint',()=>showFingerprint()));return;}
  if(!value.peer){area.hidden=false;area.append(el('h2',null,'Better with your person.'),el('p',null,'This room has a place for one more. Invite someone to start your shared shelf.'));area.append(button('Create invitation ↗',()=>showInvite(value)));return;}
  if(value.peer.status==='pending'){area.hidden=false;area.append(el('h2',null,`${value.peer.name} is at the door.`),el('p',null,'Compare their device fingerprint before letting them in. An invitation alone does not grant access.'));area.append(button('Review join request ↗',()=>reviewPeer(value)));}
}
async function reviewPeer(value){const body=modal('Is this your person?');paragraph(body,`Ask ${value.peer.name} to open Settings → My fingerprint and compare the entire code with this one, over a channel you already trust.`);
  body.append(el('div','fingerprint',await fingerprint(value.peer.publicKey)));
  const form=el('form'),label=el('label','check-label'),check=el('input');check.type='checkbox';check.required=true;label.append(check,el('span',null,'I compared the full fingerprint with my friend and it matches.'));form.append(label);
  formSubmit(form,`Approve ${value.peer.name}`,async()=>{if(!check.checked)return;await approvePeer(value);$('modal').close();await refresh();notice('You’re connected. Share something good.');});body.append(form);
  body.append(button('Reject request',async()=>{await state.ctx.api.request(`/rooms/${value.id}/reject`,{method:'POST',body:{userId:value.peer.id}});$('modal').close();await refresh();notice('Request rejected. Create a new invitation for your friend.');},'secondary danger'));
}
async function showFingerprint(){const body=modal('Your device fingerprint.');paragraph(body,'Share this public code with your friend. They should compare the entire code before approving your device. Your private key stays here.');body.append(el('div','fingerprint',await fingerprint(state.ctx.identity.publicKey)));}
function renderSelected(changed=false){const value=room();
  $('room-title').textContent=value?.name||'Good things travel.';$('breadcrumb-room').textContent=value?.name||'Your rooms';
  $('room-subtitle').textContent=value?(value.status==='active'&&value.peer?.status==='active'?`A private shelf for you and ${value.peer.name}.`:'A little space. Just waiting for good company.'):'Make a room. Bring your person. Share something good.';
  $('room-menu').hidden=!value;$('feed-header').hidden=!value || value.status==='pending';
  $('compose').hidden=!value || value.status!=='active' || value.peer?.status!=='active' || Boolean(value.keyError) || !value.local;
  renderPairing(value);
}
function renderFeed(){
  const value=room(),scrollTop=$('feed').scrollTop;$('feed').replaceChildren();$('feed-count').textContent=state.messages.length||'';
  $('load-older').hidden=!readsInbox()||!state.hasMore;$('feed').setAttribute('aria-busy',String(state.loading));
  if(!readsInbox()){$('empty').hidden=true;return;}
  if(state.loading&&!state.messages.length){$('feed').append(el('p','loading','Loading videos…'));$('empty').hidden=true;return;}
  for(const entry of [...state.messages].reverse()){
    if(entry.error){$('feed').append(el('div','message-error',entry.error));continue;}
    const content=entry.content,card=el('article','video-card'),cover=el('a','video-cover');card.setAttribute('role','listitem');
    function videoLink(link){link.href=content.url;link.target='_blank';link.rel='noopener noreferrer';if(isExtension)link.onclick=event=>{event.preventDefault();openYouTube(content.url,chrome.tabs).catch(error=>notice(error.message,true));};}
    videoLink(cover);cover.setAttribute('aria-label',`Watch ${content.title||'YouTube video'}`);cover.append(el('span','cover-play','▶'),el('span','cover-tag','YOUTUBE'));
    const details=el('div','card-body'),heading=el('h3'),link=el('a',null,content.title||'A video worth sharing');videoLink(link);link.title=content.title||'YouTube video';heading.append(link);details.append(heading);
    if(content.note){const note=el('p','card-note',content.note);note.title=content.note;details.append(note);}
    const sender=entry.sender_id===state.ctx.identity.id?'You':value.members.find(m=>m.id===entry.sender_id)?.name||'Your friend';
    const meta=el('div','card-meta');meta.append(el('span','tiny-avatar',sender.slice(0,1)),el('span',null,sender));const time=el('time',null,new Date(entry.created_at).toLocaleDateString([],{month:'short',day:'numeric'}));time.dateTime=new Date(entry.created_at).toISOString();time.title=new Date(entry.created_at).toLocaleString();meta.append(time);details.append(meta);card.append(cover,details);$('feed').append(card);
  }
  $('feed').scrollTop=scrollTop;
  $('empty').hidden=Boolean(state.messages.length)||!value||value.status==='pending'||!value.peer||value.peer.status!=='active'||Boolean(value.keyError);
  if(!value&&!isPopup)$('empty').hidden=false;
  $('empty-create').hidden=Boolean(value);$('empty').querySelector('h2').textContent=value?'No videos yet':'Create your first room';
  $('empty-text').textContent=value?'Shared videos will appear here.':'Create a room or join your friend to start sharing.';
}
async function renderOutbox(){const items=await storage.get('outbox')||[];$('outbox').replaceChildren();$('outbox').hidden=!items.length;if(!items.length)return;
  $('outbox').append(el('strong',null,`${items.length} video${items.length===1?'':'s'} waiting to send`),el('p',null,items.some(i=>i.error)?'A share needs attention. Open Settings to inspect or discard it.':'Encrypted on this device. We’ll retry when the server is available and your browser is running.'));
  $('outbox').append(button('Retry now',async()=>{await flushOutbox();await refresh();},'secondary'));
}
async function refresh(changed=false){
  if(!state.ctx)return;
  if(state.refreshing){state.refreshAgain=true;return;}
  state.refreshing=true;
  try{
    const previous=state.selected;state.rooms=await listRooms();state.offline=state.rooms.some(value=>value.offline);
    state.selected=selectedRoom(state.rooms,state.selected);
    if(previous!==state.selected){state.messages=[];state.hasMore=false;await storage.set('selectedRoom',state.selected);}
    renderRooms();renderSelected(changed||previous!==state.selected);renderView();
    const value=room();
    if(readsInbox()&&value?.local&&value.status==='active'&&!value.keyError){
      state.loading=true;renderFeed();const response=await getMessages(value);
      if(value.id!==state.selected||!readsInbox()){state.refreshAgain=true;return;}
      state.messages=response.messages;state.hasMore=response.hasMore;state.loading=false;renderFeed();
      if(canAcknowledge({isPopup,view:state.view,requestedRoomId:value.id,selectedRoomId:state.selected,visible:document.visibilityState==='visible',focused:document.hasFocus(),offline:value.offline,obscured:$('modal').open,messages:response.messages})){
        await state.ctx.api.request(`/rooms/${value.id}/read`,{method:'POST',body:{seq:response.messages.at(-1).seq}});value.unread=0;renderRooms();
      }
    }else{state.messages=[];state.hasMore=false;state.loading=false;renderFeed();}
    await renderOutbox();const offline=state.rooms.some(r=>r.offline);$('connection').classList.toggle('offline',offline);$('connection').lastChild.textContent=offline?' Offline · cached':' Connected';
    if(isExtension)chrome.runtime.sendMessage({type:'refresh-badge'}).catch(()=>{});
  }catch(error){state.loading=false;renderFeed();notice(error.message,true);$('connection').classList.add('offline');$('connection').lastChild.textContent=' Offline';}
  finally{state.refreshing=false;if(state.refreshAgain){state.refreshAgain=false;refresh();}}
}
$('refresh').onclick=()=>task($('refresh'),()=>refresh());
$('inbox-refresh').onclick=()=>task($('inbox-refresh'),()=>refresh());
$('load-older').onclick=()=>task($('load-older'),async()=>{
  const value=room();if(!value||!readsInbox())return;
  const response=await getMessages(value,state.messages[0]?.seq);
  if(value.id!==state.selected||!readsInbox())return;
  const known=new Set(state.messages.map(message=>message.id));state.messages=[...response.messages.filter(message=>!known.has(message.id)),...state.messages];state.hasMore=response.hasMore;renderFeed();
});
$('share-form').onsubmit=event=>{event.preventDefault();task($('send'),async()=>{
  const url=youtubeVideo($('video-url').value);if(!url)throw new Error('Choose a valid YouTube video, Short, or live stream.');
  $('video-url').value=url;
  const title=$('video-title-input').value.trim() || (state.currentVideo?.url===url?state.currentVideo.title:'A video worth sharing');
  const controls=['video-url','video-title-input','video-note','quick-room'];
  for(const id of controls)$(id).disabled=true;
  $('send').textContent='Sending…';
  let sent;try{sent=await sendVideo(room(),{url,title:(title||'YouTube video').slice(0,300),note:$('video-note').value.trim()});}finally{$('send').textContent='Send ↗';for(const id of controls)$(id).disabled=false;}
  $('video-note').value='';await storage.set('composeDraft',null);
  $('quick-capture').textContent=state.currentVideo?'YouTube link & title captured':'Ready to share another video.';notice(sent?'Sent ✓':'Saved to your encrypted outbox. We’ll retry when you’re online.');await refresh();
});};
$('room-menu').onclick=()=>{const value=room(),body=modal(value.name);paragraph(body,'Two people. One shared shelf. Message content expires from the server after 90 days.');
  if(value.peer?.status==='active')paragraph(body,`Connected with ${value.peer.name}.`);
  if(!value.peer&&value.owner_id===state.ctx.identity.id)body.append(button('Create invitation ↗',()=>showInvite(value)));
  body.append(button('My fingerprint',()=>showFingerprint(),'secondary'));
  if(value.peer?.status==='active')body.append(button('Member fingerprint',async()=>{const panel=modal(`${value.peer.name}’s fingerprint`);paragraph(panel,'Compare this public code directly with your friend if you want to verify their identity.');panel.append(el('div','fingerprint',await fingerprint(value.peer.publicKey)));},'secondary'));
  const actions=el('div','modal-actions');actions.append(button(value.status==='pending'?'Cancel join request':'Close room for both people',async()=>{
    const confirmBody=modal(value.status==='pending'?'Cancel this request?':'Close this room?');paragraph(confirmBody,value.status==='pending'?'Your friend will no longer see your pending request.':'This removes this room and its stored videos for both people. It cannot remove copies your friend already saved.');
    confirmBody.append(button('Confirm',async()=>{await state.ctx.api.request(`/rooms/${value.id}/leave`,{method:'POST',body:{}});await update('roomKeys',keys=>{const next={...keys};delete next[value.id];return next;});await update('outbox',items=>(items||[]).filter(item=>item.roomId!==value.id));$('modal').close();state.selected=null;await refresh(true);notice('Room closed.');},'secondary danger'));
  },'secondary danger'));body.append(actions);
};
async function settingsDialog(){if(!state.ctx){restoreDialog();return;}const body=modal('Your space, your keys.');
  paragraph(body,`${state.ctx.identity.name} · Device identity stored in this browser profile.`);
  const server=el('div','settings-row');server.append(el('h3',null,'Shared server'),el('p','mono',state.ctx.server));body.append(server);
  const keys=el('div','settings-row');keys.append(el('h3',null,'Device identity'),el('p',null,'Back up before reinstalling or switching profiles. Losing this identity means losing access to existing rooms.'));const actions=el('div','modal-actions');actions.append(button('Add my other browser / device',()=>addDeviceDialog(),'secondary'),button('My fingerprint',()=>showFingerprint(),'secondary'),button('Export encrypted backup',()=>backupDialog(),'secondary'),button('Restore backup',()=>restoreDialog(),'secondary'));keys.append(actions);body.append(keys);
  const privacy=el('div','settings-row');privacy.append(el('h3',null,'What stays private'),el('p',null,'Links, titles, and notes are encrypted. The server sees display names, room membership, message sizes and timing. No WhatsApp access, analytics, or automatic thumbnail requests. Keys on this device are not protected from malware or someone using your unlocked browser.'));body.append(privacy);
  const outbox=await storage.get('outbox')||[];if(outbox.length){const pending=el('div','settings-row');pending.append(el('h3',null,'Unsent videos'));for(const item of outbox){paragraph(pending,item.error||'Waiting for connection.');pending.append(button('Discard this unsent video',async()=>{await update('outbox',values=>(values||[]).filter(value=>value.id!==item.id));await settingsDialog();await renderOutbox();},'secondary'));}body.append(pending);}
}
for(const id of ['settings','settings-top','quick-settings'])$(id).onclick=()=>settingsDialog().catch(e=>notice(e.message,true));
function backupDialog(){const body=modal('Take your space with you.');paragraph(body,'This file contains your identity and room keys, encrypted with your password. Keep both safe. We cannot recover a forgotten password.');
  const form=el('form'),password=labelInput(form,'Backup password (12+ characters)','password');password.minLength=12;password.required=true;password.autocomplete='new-password';
  formSubmit(form,'Download encrypted backup',async()=>{const value={v:1,settings:await storage.get('settings'),identity:await storage.get('identity'),roomKeys:await storage.get('roomKeys')||{},pins:await storage.get('pins')||{}};
    const data=await encryptBackup(value,password.value);const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=el('a');link.href=url;link.download=`quicksend-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);password.value='';$('modal').close();notice('Encrypted backup downloaded. Keep the file and password safe. Use browser pairing for a new device.');});body.append(form);
}
function restoreDialog(){const body=modal('Welcome back.');paragraph(body,'Restore the same identity in another browser, or recover your rooms. This replaces this profile’s QuickSend identity and local keys. Existing unsent videos must be sent or discarded first.');
  const form=el('form'),file=labelInput(form,'Encrypted backup file','file');file.accept='.json';file.required=true;
  const password=labelInput(form,'Backup password','password');password.required=true;password.minLength=12;password.autocomplete='current-password';
  const checkLabel=el('label','check-label'),check=el('input');check.type='checkbox';check.required=true;checkLabel.append(check,el('span',null,'Replace this browser profile’s QuickSend identity with the backup.'));form.append(checkLabel);
  formSubmit(form,'Unlock and restore',async()=>{
    if((await storage.get('outbox')||[]).length)throw new Error('Send or discard unsent videos before restoring.');
    if(!file.files[0]||file.files[0].size>1000000)throw new Error('Choose a backup file smaller than 1 MB.');
    const value=await decryptBackup(JSON.parse(await file.files[0].text()),password.value);
    await validateSnapshot(value);const server=backendOrigin(value.settings.server);
    const ready=modal('Your backup is unlocked.');
    paragraph(ready,`Restore ${value.identity.name} using ${server}. The next click grants access to that server and replaces this profile’s QuickSend identity.`);
    ready.append(button('Connect and restore',async()=>{
      await grantServer(server);await restoreSnapshot(value);
      password.value='';$('modal').close();await boot();notice('Identity restored. You can use the same rooms in this browser.');
    }));
  });body.append(form);
}
$('restore-onboarding').onclick=restoreDialog;
function openFullView(){if(isExtension)chrome.tabs.create({url:chrome.runtime.getURL('app.html')});else window.open('app.html','_blank','noopener');}
$('expand').onclick=openFullView;
$('quick-expand').onclick=openFullView;
function verificationForm(body,label,onVerified){
  const form=el('form'),line=el('label','check-label'),check=el('input');check.type='checkbox';check.required=true;
  line.append(check,el('span',null,label));form.append(line);formSubmit(form,'Confirm and continue',async()=>{if(check.checked)await onVerified();});body.append(form);
}
async function addDeviceDialog(){
  const body=modal('Add your other browser.');paragraph(body,'On your new browser, open QuickSend and choose “Already use QuickSend? Pair this browser”. Paste its pairing code here. Pair only devices you own.');
  const form=el('form'),input=el('textarea');input.required=true;input.maxLength=3000;input.placeholder='qsd1.…';input.setAttribute('aria-label','Device pairing code');form.append(input);
  formSubmit(form,'Review new browser',async()=>{
    const request=parsePairing(input.value);if(request.server!==state.ctx.server)throw new Error('Both browsers must use the same server.');
    const panel=modal('Check your new browser.');paragraph(panel,'Compare this entire fingerprint with the one shown on your new browser. This transfers your identity, access token, and all current room keys.');
    panel.append(el('div','fingerprint',await fingerprint(request.publicKey)));
    verificationForm(panel,'I own this device and the full fingerprint matches.',async()=>{await approveDevice(input.value);const ready=modal('Transfer ready.');paragraph(ready,'On the new browser, choose Check for approval, then compare its sender fingerprint with this one before accepting.');ready.append(el('div','fingerprint',await fingerprint(state.ctx.identity.publicKey)));});
  });body.append(form);
}
async function receiveDeviceDialog(){
  if(state.ctx)throw new Error('Use a fresh browser profile to receive your identity.');
  const server=backendOrigin($('server-url').value);await grantServer(server);
  const session=await startPairing(server);showDeviceSession(session);
}
async function showDeviceSession(session){
  const body=modal('Pair this browser.');paragraph(body,`On your existing browser: Settings → Add my other browser / device. Paste this code there and compare the full fingerprint below. Expires at ${new Date(session.expiresAt).toLocaleTimeString()}. Keep this code private.`);
  const input=el('textarea');input.readOnly=true;input.value=session.code;input.setAttribute('aria-label','New browser pairing code');body.append(input,el('div','fingerprint',await fingerprint(session.identity.publicKey)));
  body.append(button('Copy pairing code',async()=>{await navigator.clipboard.writeText(session.code);notice('Pairing code copied.');}));
  body.append(button('Check for approval',async()=>{
    const result=await receiveDevice(session);if(!result){notice('Waiting for approval on your existing browser.');return;}
    const ready=modal('Verify your existing browser.');paragraph(ready,'Compare this entire sender fingerprint with the one on your existing browser. Accepting installs the same identity here.');ready.append(el('div','fingerprint',result.fingerprint));
    verificationForm(ready,'The full sender fingerprint matches my existing browser.',async()=>{await restoreSnapshot(result.snapshot);await cancelPairing(session).catch(()=>notice('Paired. Temporary relay data will expire automatically.'));$('modal').close();await boot();notice('Browser paired. Your current rooms are ready.');});
  },'secondary'));
  body.append(button('Cancel pairing',async()=>{await cancelPairing(session);$('modal').close();notice('Pairing cancelled.');},'secondary'));
}
$('pair-onboarding').onclick=()=>receiveDeviceDialog().catch(error=>notice(error.message,true));
async function boot(){state.ctx=await client();
  $('quick-share').disabled=!state.ctx;$('quick-inbox').disabled=!state.ctx;
  state.feedLayout=(await storage.get('feedLayout'))==='list'?'list':'cards';renderView();
  $('onboarding').hidden=Boolean(state.ctx);$('workspace').hidden=!state.ctx;
  if(!state.ctx){$('server-url').value=location.hostname==='localhost'||location.hostname==='127.0.0.1'?`http://localhost:${location.port||8787}`:DEFAULT_SERVER;$('rooms').replaceChildren();return;}
  $('profile-name').textContent=state.ctx.identity.name;$('profile-avatar').textContent=state.ctx.identity.name.slice(0,1).toUpperCase();$('profile-detail').textContent='Your device identity';
  state.selected=await storage.get('selectedRoom');
  await refresh(true);
}
async function prepareCompose(){
  if(isPopup && isExtension)state.currentVideo=await captureYouTube(chrome.tabs);
  const draft=composeDraft(state.currentVideo,isPopup?await storage.get('composeDraft'):null);
  $('video-url').value=draft.url;$('video-title-input').value=draft.title;$('video-note').value=draft.note;
  $('current-title').textContent=state.currentVideo?.title||'What are we watching?';
  $('quick-capture').textContent=state.currentVideo?'YouTube link & title captured':draft.url?'Draft restored · check the link before sending':'Open on a YouTube video to capture it, or paste a link.';
}
for(const id of ['video-url','video-title-input','video-note'])$(id).addEventListener('input',()=>{
  if(isPopup)storage.set('composeDraft',{url:$('video-url').value,title:$('video-title-input').value,note:$('video-note').value,updatedAt:Date.now()}).catch(()=>notice('Could not save this draft.',true));
});
$('share-form').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!$('send').disabled){event.preventDefault();$('share-form').requestSubmit($('send'));}});
await prepareCompose();await boot();
if(isPopup && !$('compose').hidden)$('video-note').focus();
setInterval(()=>{if(state.ctx && document.visibilityState==='visible'&&!$('modal').open)refresh();},15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.ctx)refresh();});
