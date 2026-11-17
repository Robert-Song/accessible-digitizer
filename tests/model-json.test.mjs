import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../utils/modelJson.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { parseModelJson, mathSourceIssues } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);

test('decode once: commands, quotes, Unicode, rows and JSON whitespace survive', () => {
  const html = String.raw`<p title="A &amp; B">\(\frac{1}{2} \times \theta + \nabla f + \rho + \nu\)</p><div>\[\begin{aligned}a&=b\\[2pt]c&=d\end{aligned}\]</div>` + '\n<p>α</p>';
  assert.equal(parseModelJson(JSON.stringify({ html, figures: [] })).html, html);
});
test('single page and batch reject the same corrupted control characters', () => {
  const page = { html: '<p>\\(10 \\'+ '\t' + 'imes 10\\)</p>', figures: [] };
  assert.throws(() => parseModelJson(JSON.stringify(page)), /control character/);
  assert.throws(() => parseModelJson(JSON.stringify({ pages: [page] }), 1), /control character/);
});
test('malformed JSON is rejected, never partially unescaped', () => {
  assert.throws(() => parseModelJson(String.raw`{"html":"<p>\(\times x\)</p>","figures":[]}`), /Invalid JSON/);
  assert.throws(() => parseModelJson('{"html":"<p>\\frac{1}{2}</p>","figures":[]}'), /control character/);
});
test('extra backslashes and unbalanced math delimiters are detected', () => {
  assert.ok(mathSourceIssues(String.raw`<p>\(n\\)</p>`).length);
  assert.ok(mathSourceIssues(String.raw`<p>\\(\times\\)</p>`).length);
  assert.ok(mathSourceIssues(String.raw`<p>\(x\]</p>`).length);
});
test('literal backslashes in code and TeX row spacing are preserved', () => {
  const html = String.raw`<pre>const re = /\\[/; C:\temp\new; \_ \$</pre><p>\[\begin{matrix}1&2\\[.5em]3&4\end{matrix}\]</p>`;
  assert.deepEqual(mathSourceIssues(html), []);
  assert.equal(parseModelJson(JSON.stringify({ html, figures: [] })).html, html);
});
test('fences are accepted but prose, missing pages and empty HTML fail closed', () => {
  const page = { html: '<h1>Test</h1>', figures: [] };
  assert.deepEqual(parseModelJson('```json\r\n' + JSON.stringify(page) + '\r\n```'), page);
  assert.throws(() => parseModelJson('Here it is: ' + JSON.stringify(page)));
  assert.throws(() => parseModelJson(JSON.stringify({ pages: [page] }), 2));
  assert.throws(() => parseModelJson('{"html":"","figures":[]}'));
});
