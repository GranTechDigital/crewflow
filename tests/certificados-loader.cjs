const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
exports.loader = function(stubs = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const localRequire = name => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      const candidate = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
      if (candidate && fs.existsSync(candidate + '.ts')) {
        const relative = path.relative(root, candidate + '.ts').replaceAll('\\', '/');
        if (Object.hasOwn(stubs, relative)) return stubs[relative];
        return load(candidate + '.ts');
      }
      return createRequire(file)(name);
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  return load;
};
