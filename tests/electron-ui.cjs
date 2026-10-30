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
    window.testStreams=[];
    window.syntheticContext=new AudioContext({sampleRate:24000});
    function media(){const dest=syntheticContext.createMediaStreamDestination();const osc=syntheticContext.createOscillator();osc.connect(dest);osc.start();testStreams.push(dest.stream);return Promise.resolve(dest.stream);}
    navigator.mediaDevices.getUserMedia=media;navigator.mediaDevices.getDisplayMedia=media;
    await syntheticContext.resume();
    $('startAudio').click();
    await new Promise(r=>setTimeout(r,1000));
    if($('stopAudio').disabled) throw Error('capture did not start: '+$('audioError').textContent);
    if(!$('languageA').disabled)throw Error('pair unlocked during capture');
    for(let i=0;i<210;i++)window.electronAPI.testEmit({type:'subtitle',source:'microphone',id:'row'+i,transcript:'Source '+i,translation:'Sous-titre '+i,status:'complete',targetLang:'pt',timestamp:Date.now()});
    // Completion can arrive in reverse order.
    window.electronAPI.testEmit({type:'subtitle',source:'system',id:'second',previousId:'first',transcript:'Second',translation:'Second translated',status:'complete',timestamp:Date.now()});
    window.electronAPI.testEmit({type:'subtitle',source:'system',id:'first',transcript:'First',translation:'First translated',status:'complete',timestamp:Date.now()});
    const rows=[...$('subtitles').children];
    if(rows.length!==200)throw Error('history not bounded');
    if(rows.at(-1).textContent.indexOf('Second translated')<0)throw Error('subtitle order');
    const copy=$('copySubtitles').getBoundingClientRect();
    if(copy.bottom>innerHeight||$('subtitles').scrollHeight<=$('subtitles').clientHeight)throw Error('subtitle overflow');
    $('stopAudio').click();await new Promise(r=>setTimeout(r,700));
    if(testStreams.some(s=>s.getTracks().some(t=>t.readyState!=='ended')))throw Error('capture leaked');
    if($('startAudio').disabled||$('languageA').disabled)throw Error('controls not restored');
    await syntheticContext.close();
    return 'PASS: language selection, long translations, two capture sources, PCM worklet, ordered and bounded subtitles, stop cleanup '+JSON.stringify(window.electronAPI.testState());
  })()`));
  win.setSize(760,500);
  assert.ok(await win.webContents.executeJavaScript(`(() => {
    const button = document.getElementById('copySubtitles').getBoundingClientRect();
    return button.bottom <= innerHeight && button.right <= innerWidth && document.getElementById('subtitles').clientHeight > 0;
  })()`), 'Subtitle controls must remain visible at the minimum window size');
  assert.deepEqual(errors,[]);

 }catch(error){console.error(error);process.exitCode=1;}finally{app.quit();}
});
