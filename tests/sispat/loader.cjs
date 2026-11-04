const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
// Carrega os módulos de produção sem alterar o runtime/dependências do projeto.
exports.loader = function(stubs = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(root, filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} }; cache.set(filename, mod);
    const nativeRequire = createRequire(filename);
    const localRequire = name => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      const candidate = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (candidate && fs.existsSync(candidate + '.ts')) return load(candidate + '.ts');
      return nativeRequire(name);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', compiled)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
};
