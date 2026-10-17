import { client, flushOutbox } from './lib/client.js';
async function poll() {
  try {
    const ctx=await client(); if(!ctx) return;
    await flushOutbox();
    const {rooms}=await ctx.api.request('/rooms');
    const count=rooms.reduce((sum,room)=>sum+room.unread,0);
    await chrome.action.setBadgeBackgroundColor({color:'#186a52'});
    await chrome.action.setBadgeText({text:count?String(Math.min(count,99)):''});
    await chrome.action.setTitle({title:count?`QuickSend · ${count} unread videos`:'QuickSend · Private video rooms'});
  } catch { /* Network failures leave the last known badge. No payload or credentials are logged. */ }
}
async function start() {
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.alarms.create('inbox',{periodInMinutes:1});
  await poll();
}
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='inbox')poll();});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || message.type!=='refresh-badge')return;
  poll().then(()=>respond({ok:true}));return true;
});
