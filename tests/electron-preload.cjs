const {contextBridge}=require('electron');
let listener; let pair=['fr','en']; const state={packets:0,commits:0,stops:0};
contextBridge.exposeInMainWorld('electronAPI',{
 getSettings:async()=>({pair,audioConfigured:true}),
 setLanguagePair:async value=>{pair=value;return {success:true,pair};},
 autoTranslate:async text=>({success:true,translation:'Translated '+text,detectedLang:pair[0],targetLang:pair[1]}),
 spellCheck:async text=>({success:true,correctedText:text}),
 startAudio:async()=>({success:true,sessionId:'test-session'}),
 clearAudio:()=>{},
 stopAudio:async()=>{state.stops++;},
 microphonePermission:async()=>true,
 sendAudio:packet=>{state.packets++;if(packet.commit)state.commits++;},
 onAudioEvent:callback=>{listener=callback;return()=>{listener=null;};},
 testEmit:event=>listener?.({sessionId:'test-session',...event}),testState:()=>state
});
