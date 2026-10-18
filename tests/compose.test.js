import test from 'node:test';
import assert from 'node:assert/strict';
import { captureYouTube,selectedRoom,composeDraft } from '../extension/lib/compose.js';

test('capture uses only the invoked active tab, cleans titles, and strips YouTube tracking',async()=>{
  const tabs={query:async options=>{assert.deepEqual(options,{active:true,currentWindow:true});return [{url:'https://www.youtube.com/watch?v=gS_nHTWZEJ8&list=private&si=tracking',title:'(3) A useful find — YouTube'}];}};
  assert.deepEqual(await captureYouTube(tabs),{url:'https://youtu.be/gS_nHTWZEJ8',title:'A useful find'});
  for(const url of ['https://youtube.com/shorts/gS_nHTWZEJ8','https://youtube.com/live/gS_nHTWZEJ8','https://youtu.be/gS_nHTWZEJ8'])assert.equal((await captureYouTube({query:async()=>[{url,title:'Title - YouTube'}]})).title,'Title');
  assert.equal(await captureYouTube({query:async()=>[{url:'https://example.com',title:'Private tab'}]}),null);
  assert.equal(await captureYouTube({query:async()=>[{title:'Restricted page'}]}),null);
  assert.equal(await captureYouTube({query:async()=>{throw Error('Permission unavailable');}}),null);
  assert.equal((await captureYouTube({query:async()=>[{url:'https://youtu.be/gS_nHTWZEJ8',title:'YouTube'}]})).title,'');
});

test('destination keeps the previous room, selects a lone room and falls back after removal',()=>{
  const pending={id:'pending',status:'pending'},ready={id:'ready',status:'active',peer:{status:'active'},local:{}};
  assert.equal(selectedRoom([ready],null),'ready');
  assert.equal(selectedRoom([pending,ready],'pending'),'pending');
  assert.equal(selectedRoom([pending,ready],'deleted'),'ready');
  assert.equal(selectedRoom([pending],null),'pending');
  assert.equal(selectedRoom([], 'deleted'),null);
});

test('drafts survive reopening for the same video but never carry a note into another capture',()=>{
  const now=Date.now(),draft={url:'https://www.youtube.com/watch?v=gS_nHTWZEJ8',title:'Edited title',note:'Personal context',updatedAt:now-100};
  assert.deepEqual(composeDraft({url:'https://youtu.be/gS_nHTWZEJ8',title:'Captured'},draft,now),{url:'https://youtu.be/gS_nHTWZEJ8',title:'Edited title',note:'Personal context'});
  assert.deepEqual(composeDraft({url:'https://youtu.be/abcdefghijk',title:'Different'},draft,now),{url:'https://youtu.be/abcdefghijk',title:'Different',note:''});
  assert.equal(composeDraft(null,draft,now).note,'Personal context');
  assert.equal(composeDraft(null,{...draft,updatedAt:now-86400001},now).url,'');
  assert.equal(composeDraft(null,{...draft,note:'x'.repeat(501)},now).url,'');
});
