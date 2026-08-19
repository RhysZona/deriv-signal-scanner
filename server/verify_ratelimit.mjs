import WebSocket from 'ws';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let targets = await (await fetch('http://127.0.0.1:9222/json')).json();
let tgt = targets.find(t => t.type === 'page');
if (tgt) {
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const myId = ++id;
    const handler = (msg) => {
      const d = JSON.parse(msg.toString());
      if (d.id === myId) { ws.off('message', handler); d.error ? reject(d.error) : resolve(d.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:5173' });
  await sleep(5000);
  ws.close();
}

targets = await (await fetch('http://127.0.0.1:9222/json')).json();
tgt = targets.find(t => t.url.includes('localhost'));
if (!tgt) { console.log('no target'); process.exit(1); }

const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.on('open', r));
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const myId = ++id;
  const handler = (msg) => {
    const d = JSON.parse(msg.toString());
    if (d.id === myId) { ws.off('message', handler); d.error ? reject(d.error) : resolve(d.result); }
  };
  ws.on('message', handler);
  ws.send(JSON.stringify({ id: myId, method, params }));
});

const checks = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    headerText: document.querySelector('header')?.innerText?.substring(0, 300),
    hasScannerStatus: !!document.body.innerText.includes('Scanner Status'),
    hasRateLimited: document.body.innerText.includes('Rate limit'),
    hasRetrying: document.body.innerText.includes('retry'),
    countdownTexts: [...document.querySelectorAll('span')].filter(s => /\\d+s/.test(s.textContent?.trim() || '')).map(s => s.textContent?.trim()).slice(0, 8),
    allAmber: [...document.querySelectorAll('[class*="amber"]')].map(e => e.textContent?.trim()).filter(t => t && t.length < 60),
  })`,
  returnByValue: true,
});

console.log(JSON.parse(checks.result.value), null, 2);
ws.close();
