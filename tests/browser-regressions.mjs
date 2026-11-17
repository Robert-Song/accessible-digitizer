import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

// Use a local Playwright installation or a provided runtime; no LLM is called.
const playwrightModule = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(playwrightModule ? pathToFileURL(playwrightModule).href : 'playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{
  name: 'regression-fixture',
  configureServer(server) { server.middlewares.use('/__regression', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html lang="en"><head><title>Regression tests</title>
    <style>.math-content { font-size:18px; color:black; background:white; } .faint { color:#eee; }</style>
    <script id="MathJax-script" type="text/plain" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    </head><body></body></html>`);
  }); }
}] });
await server.listen();
const address = server.httpServer.address();
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/__regression`);
  const auditResults = await page.evaluate(async () => {
    const { runAccessibilityAudit, sanitizeGeneratedHtml } = await import('/utils/accessibility.ts');
    const html = '<section><h1>Example</h1><input></section>';
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => runAccessibilityAudit(html)));
    const contrast = await runAccessibilityAudit('<section><h1>Title</h1><p class="faint">Low contrast text</p></section>');
    const continuation = await runAccessibilityAudit('<section><p>Continued explanation.</p></section>', { requireH1: false });
    const headerlessTableAudit = await runAccessibilityAudit('<section><h1>Matrix</h1><table><caption>Filter matrix F</caption><tbody><tr><td>2</td><td>-1</td></tr><tr><td>1</td><td>3</td></tr></tbody></table></section>');
    const sanitizedMatrix = sanitizeGeneratedHtml('<section><h1>Matrix</h1><table><caption>Filter matrix F</caption><tbody><tr><td>2</td><td>-1</td></tr><tr><td>1</td><td>3</td></tr></tbody></table></section>');
    const sanitizedMatrixAudit = await runAccessibilityAudit(sanitizedMatrix);
    const codes = String.raw`<pre>const re = /\\[/; \_ \$ C:\temp\new</pre>`;
    return { concurrent, contrast, continuation, headerlessTableAudit, sanitizedMatrix, sanitizedMatrixAudit,
      codePreserved: sanitizeGeneratedHtml(codes).includes(codes),
      remainingFrames: document.querySelectorAll('iframe').length };
  });
  assert.equal(auditResults.remainingFrames, 0);
  assert.equal(auditResults.codePreserved, true);
  assert.equal(auditResults.headerlessTableAudit.checks.find(c => c.title === 'Table header text')?.passed, false);
  assert.equal(auditResults.sanitizedMatrixAudit.passed, true, JSON.stringify(auditResults.sanitizedMatrixAudit));
  assert.ok(auditResults.sanitizedMatrix.includes('<th scope="col">Column 1</th><th scope="col">Column 2</th>'));
  for (const result of auditResults.concurrent) assert.ok(result.violations.some(v => v.id === 'label'));
  assert.ok(auditResults.contrast.violations.some(v => v.id === 'color-contrast'), JSON.stringify(auditResults.contrast));
  assert.equal(auditResults.continuation.passed, true, JSON.stringify(auditResults.continuation));
  console.log('PASS concurrent isolated axe audits, real contrast detection, continuation headings, code preservation and cleanup');

  const requests = [];
  let responseText = '<section><h1>Example</h1><p>Original wording.</p></section>';
  await page.route('**/api/llm/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { choices: [{ message: { content: responseText } }] } });
  });
  const original = '<section><p>Original wording.</p></section>';
  const repair = () => page.evaluate(async html => {
    const { auditAndRepair } = await import('/services/accessibilityPipeline.ts');
    return auditAndRepair(html);
  }, original);
  const repaired = await repair();
  assert.equal(repaired.audit.passed, true, JSON.stringify(repaired.audit));
  assert.equal(requests.length, 1);
  assert.ok(requests[0].messages[1].content.includes('Heading Order'));
  console.log('PASS custom-only failures trigger repair and receive a matching re-audit');

  responseText = original;
  const unchanged = await repair();
  assert.equal(unchanged.audit.passed, false);
  assert.ok(unchanged.audit.manualReview.some(s => s.includes('no changes')));
  responseText = '<section><h1>Example</h1><p role="not-a-role">Original wording.</p></section>';
  const regressed = await repair();
  assert.equal(regressed.html, original);
  assert.ok(regressed.audit.manualReview.some(s => s.includes('previous HTML')));
  responseText = '';
  const failed = await repair();
  assert.equal(failed.html, original);
  assert.ok(failed.audit.manualReview.some(s => s.includes('repair failed')));
  console.log('PASS no-op stop, regression rejection, and failed repair retain matching HTML/report');

  let conversionCalls = 0;
  await page.unroute('**/api/llm/chat');
  await page.route('**/api/llm/chat', route => {
    conversionCalls++;
    const text = conversionCalls === 1 ? String.raw`{"html":"<p>\(\times x\)</p>","figures":[]}`
      : JSON.stringify({ html: String.raw`<h1>Math</h1><p>\(10 \times 10\)</p>`, figures: [] });
    return route.fulfill({ json: { choices: [{ message: { content: text } }] } });
  });
  const converted = await page.evaluate(async () => {
    const { convertPageToHtml } = await import('/services/aiService.ts');
    return convertPageToHtml('test-image', 1);
  });
  assert.equal(conversionCalls, 2);
  assert.ok(converted.page.html.includes(String.raw`\times`));
  console.log('PASS malformed conversion retries once without mutating backslashes');

  conversionCalls = 0;
  await page.unroute('**/api/llm/chat');
  await page.route('**/api/llm/chat', route => {
    conversionCalls++;
    const pages = [{ html: String.raw`<p>\(\nabla f\)</p>`, figures: [] }, { html: String.raw`<p>\(\theta\)</p>`, figures: [] }];
    const text = JSON.stringify({ pages: conversionCalls === 1 ? pages.slice(0, 1) : pages });
    return route.fulfill({ json: { choices: [{ message: { content: text } }] } });
  });
  const batch = await page.evaluate(async () => {
    const { convertBatchToHtml } = await import('/services/aiService.ts');
    return convertBatchToHtml([{ base64: 'test', pageNumber: 1 }, { base64: 'test', pageNumber: 2 }]);
  });
  assert.equal(conversionCalls, 2);
  assert.equal(batch.pages.length, 2);
  assert.ok(batch.pages[0].html.includes(String.raw`\nabla`));
  console.log('PASS batch retries schema errors and preserves math on every page');

  const math = await page.evaluate(async () => {
    const { runAccessibilityAudit } = await import('/utils/accessibility.ts');
    const good = await runAccessibilityAudit(String.raw`<section><h1>Math</h1><p>\(\frac{1}{2} \times \theta\)</p></section>`);
    const bad = await runAccessibilityAudit(String.raw`<section><h1>Math</h1><p>\(\frac{1}\)</p></section>`);
    return { good, bad };
  });
  assert.equal(math.good.checks.find(c => c.title === 'Math rendering')?.passed, true, JSON.stringify(math.good));
  assert.equal(math.bad.checks.find(c => c.title === 'Math rendering')?.passed, false, JSON.stringify(math.bad));
  assert.equal(math.bad.checks.find(c => c.title === 'Math rendering')?.repairable, undefined);
  console.log('PASS actual MathJax rendering distinguishes valid and broken TeX');

  // Exercise the actual configurations, including template-literal decoding
  // for exports/audit frames. A MathJax error check alone misses literal \_.
  for (const [file, template] of [['index.html', false], ['App.tsx', true], ['utils/accessibility.ts', true]]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    let config = source.match(/window\.MathJax = \{[\s\S]*?\n\s*\};/)[0];
    if (template) config = Function(`return \`${config}\`;`)();
    const mathPage = await browser.newPage();
    try {
      await mathPage.goto(`http://127.0.0.1:${address.port}/__regression`);
      await mathPage.evaluate(() => {
        document.body.innerHTML = String.raw`<p id="leaky">\[\text{leaky\_relu}(z)=\begin{cases}z & \text{if } z\geq 0 \\ \alpha z & \text{if } z&lt;0\end{cases}\]</p><p id="sub">\(x_i\)</p><p id="special">\(\text{cost\_name: 50\% \& \#1}\)</p><pre id="code">literal \_ and x_i</pre>`;
      });
      await mathPage.addScriptTag({ content: config });
      await mathPage.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js' });
      const rendered = await mathPage.evaluate(async () => {
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([document.body]);
        return {
          text: document.querySelector('#leaky mjx-assistive-mml mtext')?.textContent,
          specials: document.querySelector('#special mjx-assistive-mml mtext')?.textContent,
          hasSubscript: Boolean(document.querySelector('#sub mjx-assistive-mml msub')),
          rows: document.querySelectorAll('#leaky mjx-assistive-mml mtr').length,
          code: document.querySelector('#code').textContent,
          errors: document.querySelectorAll('[data-mjx-error], mjx-merror, merror').length
        };
      });
      assert.equal(rendered.text, 'leaky_relu', `${file}: ${JSON.stringify(rendered)}`);
      assert.equal(rendered.specials, 'cost_name: 50% & #1', file);
      assert.equal(rendered.hasSubscript, true, file);
      assert.equal(rendered.rows, 2, file);
      assert.equal(rendered.code, String.raw`literal \_ and x_i`, file);
      assert.equal(rendered.errors, 0, file);
    } finally {
      await mathPage.close();
    }
  }
  console.log('PASS preview/export/audit text escapes render correctly; subscripts, row breaks and code survive');

  await page.route('**/missing-mathjax.js', route => route.abort());
  const unavailable = await page.evaluate(async () => {
    document.querySelector('#MathJax-script').src = '/missing-mathjax.js';
    const { runAccessibilityAudit } = await import('/utils/accessibility.ts');
    const { needsAccessibilityRepair } = await import('/services/accessibilityPipeline.ts');
    const audit = await runAccessibilityAudit(String.raw`<section><h1>Math</h1><p>\(x\)</p></section>`);
    return { audit, needsRepair: needsAccessibilityRepair(audit) };
  });
  assert.equal(unavailable.audit.passed, false);
  assert.equal(unavailable.audit.checks.find(c => c.title === 'Math rendering')?.repairable, false);
  assert.equal(unavailable.needsRepair, false);
  console.log('PASS unavailable MathJax requires review without wasting model repairs');
} finally {
  await browser.close();
  await server.close();
}
