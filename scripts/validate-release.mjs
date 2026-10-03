import fs from 'node:fs';

const fail = message => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};
const pass = message => console.log(`✓ ${message}`);
const read = path => fs.readFileSync(path, 'utf8');

const required = [
  'index.html',
  'v16.html',
  'app-v16.js',
  'config.js',
  'manifest.webmanifest',
  'version.json',
  'activity-v1.js',
  'orders-v1.js',
  'risk-v1.js',
  'documents-v1.js',
  'coshh-v1.js',
  'training-v1.js',
  'operations-v1.js'
];

for (const path of required) {
  if (fs.existsSync(path)) pass(`${path} exists`);
  else fail(`${path} is missing`);
}

for (let version = 7; version <= 15; version += 1) {
  for (const path of [`v${version}.html`, `app-v${version}.js`]) {
    if (fs.existsSync(path)) fail(`${path} should not be present in the stabilised branch`);
  }
}
if (fs.existsSync('app.js')) fail('legacy app.js should not be present');

const index = read('index.html');
if (/http-equiv=["']refresh["']/i.test(index)) fail('index.html must not use a meta refresh');
else pass('index.html has no meta refresh');
if (/location\.replace\(target\.href\)/.test(index)) pass('index.html uses one controlled app redirect');
else fail('index.html controlled redirect is missing');
if (/target\.search\s*=\s*window\.location\.search/.test(index) && /target\.hash\s*=\s*window\.location\.hash/.test(index)) pass('entry redirect preserves auth query/hash data');
else fail('entry redirect must preserve query and hash data');

const manifest = JSON.parse(read('manifest.webmanifest'));
if (manifest.start_url === './') pass('installed app starts from the stable root entry');
else fail(`manifest start_url should be ./, found ${manifest.start_url}`);

const version = JSON.parse(read('version.json'));
if (!Object.hasOwn(version, 'url') && version.automaticRedirect === false) pass('legacy forced version redirect is disabled');
else fail('version.json must not expose a forced redirect URL');

const page = read('v16.html');
const expectedScripts = ['config.js', 'activity-v1.js', 'orders-v1.js', 'app-v16.js', 'risk-v1.js', 'documents-v1.js', 'coshh-v1.js', 'training-v1.js', 'operations-v1.js'];
for (const script of expectedScripts) {
  if (page.includes(script)) pass(`v16.html references ${script}`);
  else fail(`v16.html does not reference ${script}`);
}

if (!process.exitCode) console.log('\nWoods Team Hub static release checks passed.');
