import test from 'node:test';
import assert from 'node:assert/strict';
import { canAcknowledge,openYouTube } from '../extension/lib/inbox.js';

test('read acknowledgements require the currently displayed verified inbox, not a stale response',()=>{
  const visible={isPopup:true,view:'inbox',requestedRoomId:'one',selectedRoomId:'one',visible:true,focused:true,offline:false,messages:[{seq:12}]};
  assert.equal(canAcknowledge(visible),true);
  for(const change of [{view:'share'},{selectedRoomId:'two'},{visible:false},{focused:false},{offline:true},{obscured:true},{messages:[]},{messages:[{seq:12,error:'Cannot verify'}]}])assert.equal(canAcknowledge({...visible,...change}),false);
  assert.equal(canAcknowledge({...visible,isPopup:false,view:'share'}),true);
});

test('video opening uses the supplied browser tabs API and only accepts canonical YouTube links',async()=>{
  const calls=[],tabs={create:async options=>{calls.push(options);return {id:123};}};
  assert.deepEqual(await openYouTube('https://www.youtube.com/shorts/gS_nHTWZEJ8?si=tracking',tabs),{id:123});
  assert.deepEqual(calls,[{url:'https://youtu.be/gS_nHTWZEJ8',active:true}]);
  await assert.rejects(()=>openYouTube('javascript:alert(1)',tabs));
  await assert.rejects(()=>openYouTube('https://example.com/watch?v=gS_nHTWZEJ8',tabs));
  assert.equal(calls.length,1);
});
