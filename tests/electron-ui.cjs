const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');

app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1000,height:700,webPreferences:{preload:require('node:path').join(__dirname,'electron-preload.cjs'),contextIsolation:true}});
 const errors=[];
 win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
 try {
  await win.loadFile(process.cwd()+'/index.html');
  await new Promise(r=>setTimeout(r,200));
  console.log(await win.webContents.executeJavaScript(`(async()=>{
    const $=id=>document.getElementById(id);
    $('languageA').value='es';$('languageA').dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,30));
    $('languageB').value='pt';$('languageB').dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,30));
    if($('languageA').value!=='es'||$('languageB').value!=='pt') throw Error('pair not saved');
    const text='Long translation.\\n'.repeat(3000);
    $('sourceText').value=text;$('sourceText').dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,900));
    const output=$('translationOutput'),rect=$('copyTranslationBtn').getBoundingClientRect();
    if(output.scrollHeight<=output.clientHeight||rect.bottom>innerHeight)throw Error('translation overflow');
    $('audioTab').click();
    $('swapLanguages').click();await new Promise(r=>setTimeout(r,30));
    if($('languageA').value!=='pt'||$('languageB').value!=='es')throw Error('Header language swap failed');
    $('swapLanguages').click();await new Promise(r=>setTimeout(r,900));
    if($('languageB').value!=='pt')throw Error('Second language not restored');
    if($('liveTarget'))throw Error('Redundant live selector remains');

    for(const id of ['captureMicrophone','captureSystem']) {
      $(id).click();
      if($(id).getAttribute('aria-pressed')!=='false')throw Error('Source toggle did not disable');
    }
    $('startAudio').click();await new Promise(r=>setTimeout(r,20));
    if(!$('audioError').textContent.includes('Select at least one'))throw Error('Empty source selection accepted');
    for(const id of ['captureMicrophone','captureSystem'])$(id).click();
    window.testStreams=[];
    window.syntheticContext=new AudioContext({sampleRate:24000});
    function media(){const dest=syntheticContext.createMediaStreamDestination();const osc=syntheticContext.createOscillator();osc.connect(dest);osc.start();testStreams.push(dest.stream);return Promise.resolve(dest.stream);}
    navigator.mediaDevices.getUserMedia=media;navigator.mediaDevices.getDisplayMedia=media;
    await syntheticContext.resume();
    $('startAudio').click();
    await new Promise(r=>setTimeout(r,1000));
    if($('stopAudio').disabled) throw Error('capture did not start: '+$('audioError').textContent);
    if(!document.querySelector('#microphoneLevel .lit'))throw Error('Synthetic audio level not shown');
    if(!$('languageA').disabled||!$('swapLanguages').disabled)throw Error('settings unlocked during capture');
    window.electronAPI.testEmit({type:'subtitle',source:'microphone',id:'streaming',transcript:'Hello everyone',translation:'Bonjour',status:'translating',timestamp:Date.now()});
    if($('subtitles').querySelector('.subtitle-translation').textContent!=='Bonjour')throw Error('streaming text not displayed');
    window.electronAPI.testEmit({type:'subtitle',source:'microphone',id:'streaming',transcript:'Hello everyone',translation:'Bonjour à tous',status:'complete',timestamp:Date.now()});
    if($('subtitles').children.length!==1||$('subtitles').querySelector('.subtitle-translation').textContent!=='Bonjour à tous')throw Error('final caption duplicated instead of updating');
    for(let i=0;i<210;i++)window.electronAPI.testEmit({type:'subtitle',source:'microphone',id:'row'+i,transcript:'Source '+i,translation:'Sous-titre '+i,status:'complete',targetLang:'pt',timestamp:Date.now()});
    // Completion can arrive in reverse order.
    window.electronAPI.testEmit({type:'subtitle',source:'system',id:'second',previousId:'first',transcript:'Second',translation:'Second translated',status:'complete',timestamp:Date.now()});
    window.electronAPI.testEmit({type:'subtitle',source:'system',id:'first',transcript:'First',translation:'First translated',status:'complete',timestamp:Date.now()});
    const rows=[...$('subtitles').children];
    if(rows.length!==200)throw Error('history not bounded');
    if(rows.at(-1).textContent.indexOf('Second translated')<0)throw Error('subtitle order');
    const copy=$('copySubtitles').getBoundingClientRect();
    if(copy.bottom>innerHeight||$('subtitles').scrollHeight<=$('subtitles').clientHeight)throw Error('subtitle overflow');
    const oldTimestamp=Date.now()-1000;
    $('cleanSubtitles').click();
    if($('subtitles').children.length||!$('copySubtitles').disabled)throw Error('Clean did not clear history');
    if($('stopAudio').disabled)throw Error('Clean stopped capture');
    window.electronAPI.testEmit({type:'subtitle',source:'microphone',id:'late',transcript:'Old',translation:'Old result',status:'complete',timestamp:oldTimestamp});
    if($('subtitles').children.length)throw Error('Cleared subtitle reappeared');
    window.electronAPI.testEmit({type:'subtitle',source:'microphone',id:'new',transcript:'New',translation:'New result',status:'complete',timestamp:Date.now()+1});
    if($('subtitles').children.length!==1||$('copySubtitles').disabled)throw Error('New subtitles blocked after Clean');
    $('stopAudio').click();await new Promise(r=>setTimeout(r,700));
    if(testStreams.some(s=>s.getTracks().some(t=>t.readyState!=='ended')))throw Error('capture leaked');
    if(document.querySelector('.source-level .lit'))throw Error('Audio level not reset on stop');
    if($('startAudio').disabled||$('languageA').disabled)throw Error('controls not restored');
    await syntheticContext.close();
    return 'PASS: language selection, long translations, two capture sources, PCM worklet, ordered and bounded subtitles, stop cleanup '+JSON.stringify(window.electronAPI.testState());
  })()`));
  win.setSize(760,500);
  assert.ok(await win.webContents.executeJavaScript(`(() => {
    const button = document.getElementById('copySubtitles').getBoundingClientRect();
    return button.bottom <= innerHeight && button.right <= innerWidth && document.getElementById('subtitles').clientHeight > 0;
  })()`), 'Subtitle controls must remain visible at the minimum window size');
  console.log(await win.webContents.executeJavaScript(`(async()=>{
    const $=id=>document.getElementById(id);
    await document.fonts.ready;
    if(!document.fonts.check('14px Supreme')||!document.fonts.check('24px Sentient'))throw Error('Brand fonts unavailable');
    const visible=id=>{const r=$(id).getBoundingClientRect();return r.width>0&&r.height>0&&r.right<=innerWidth&&r.bottom<=innerHeight&&r.left>=0;};
    for(const id of ['captureMicrophone','captureSystem','swapLanguages','startAudio','cleanSubtitles','copySubtitles'])if(!visible(id))throw Error('Live control outside viewport: '+id);
    $('translateTab').focus();$('translateTab').click();
    $('translateTab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    if($('spellCheckTab').getAttribute('aria-selected')!=='true'||!$('spellCheckMode').classList.contains('active'))throw Error('Keyboard tab navigation failed');
    $('spellCheckInput').value='A long sentence. '.repeat(3000);$('spellCheckInput').dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,850));
    if(!visible('copySpellCheckBtn')||$('spellCheckOutput').scrollHeight<=$('spellCheckOutput').clientHeight)throw Error('Spell check scroll/controls failed');
    $('translateTab').click();
    if(!visible('copyTranslationBtn')||!visible('swapTranslationBtn'))throw Error('Translation controls outside viewport');
    return 'PASS: Edgee fonts, keyboard tabs and all three workspaces at 760 × 500';
  })()`));
  assert.deepEqual(errors,[]);

 }catch(error){console.error(error);process.exitCode=1;}finally{app.quit();}
});
