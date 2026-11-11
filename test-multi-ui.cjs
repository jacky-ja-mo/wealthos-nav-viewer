const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('cross-provider public search uses only static public index and no private tokens',()=>{
 const js=fs.readFileSync('multi-source-ui.js','utf8');
 assert.match(js,/sources\/boc-public-nav\.json/);
 assert.match(js,/r\.code\.toUpperCase\(\)===term/);
 assert.doesNotMatch(js,/service_role|SUPABASE_SECRET_KEYS|password|token_sha256/);
});
test('site includes source status and can never silently claim full coverage',()=>{
 const page=fs.readFileSync('index.html','utf8');
 assert.match(page,/multiForm/);
 assert.match(page,/multiResults/);
 assert.match(page,/部分代销产品/);
});
