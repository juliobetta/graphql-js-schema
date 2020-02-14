/**
* The MIT License (MIT)
* Copyright (c) 2016 Shopify Inc.
* 
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
* DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
* OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
* OR OTHER DEALINGS IN THE SOFTWARE.
* 
* 
* Version: 0.7.1 Commit: 929aec6
**/'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = generateSchemaModules;
exports.generateSchemaBundle = generateSchemaBundle;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash.kebabcase');

var _lodash2 = _interopRequireDefault(_lodash);

var _babelGenerator = require('babel-generator');

var _babelGenerator2 = _interopRequireDefault(_babelGenerator);

var _tmp = require('tmp');

var _tmp2 = _interopRequireDefault(_tmp);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _rollup = require('rollup');

var _simplifyType = require('./simplify-type');

var _simplifyType2 = _interopRequireDefault(_simplifyType);

var _typeTemplate = require('./type-template');

var _typeTemplate2 = _interopRequireDefault(_typeTemplate);

var _bundleTemplate = require('./bundle-template');

var _bundleTemplate2 = _interopRequireDefault(_bundleTemplate);

var _writers = require('./writers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function yieldTypes(schema) {
  return schema.types;
}

function filterTypes(whitelistConfig) {
  return function (types) {
    if (!whitelistConfig) {
      return types;
    }

    const whitelistTypes = Object.keys(whitelistConfig);

    return types.filter(simplifiedType => {
      return whitelistTypes.includes(simplifiedType.name);
    });
  };
}

function simplifyTypes(whitelistConfig) {
  return function (types) {
    return types.map(type => (0, _simplifyType2.default)(type, whitelistConfig));
  };
}

function filenameForType(type) {
  return _path2.default.join('types', `${ (0, _lodash2.default)(type.name) }.js`);
}

function mapTypesToFiles(simplifiedTypes) {
  return simplifiedTypes.map(simplifiedType => {
    return {
      name: simplifiedType.name,
      body: (0, _babelGenerator2.default)((0, _typeTemplate2.default)(simplifiedType)).code,
      path: filenameForType(simplifiedType)
    };
  });
}

function injectBundle(rootTypeNames, bundleName) {
  return function (typeFileMaps) {
    const bundleAst = (0, _bundleTemplate2.default)(rootTypeNames, typeFileMaps, bundleName.replace(' ', ''));
    const bundle = (0, _babelGenerator2.default)(bundleAst).code;

    typeFileMaps.push({
      body: bundle,
      path: `${ (0, _lodash2.default)(bundleName) }.js`
    });

    return typeFileMaps;
  };
}

function extractRootTypeNames({ queryType, mutationType, subscriptionType }) {
  return {
    queryTypeName: queryType ? queryType.name : null,
    mutationTypeName: mutationType ? mutationType.name : null,
    subscriptionTypeName: subscriptionType ? subscriptionType.name : null
  };
}

function flow(arg, functions) {
  return functions.reduce((acc, fn) => fn(acc), arg);
}

function generateSchemaModules(introspectionResponse, bundleName, whitelistConfig) {
  const schema = (() => {
    if (!!response.data) {
      return response.data.__schema;
    }

    return response.__schema;
  })(introspectionResponse);

  return flow(schema, [yieldTypes, filterTypes(whitelistConfig), simplifyTypes(whitelistConfig), mapTypesToFiles, injectBundle(extractRootTypeNames(schema), bundleName)]);
}

function generateSchemaBundle(introspectionResponse, bundleName, whitelistConfig) {
  const files = generateSchemaModules(introspectionResponse, bundleName, whitelistConfig);

  _tmp2.default.setGracefulCleanup();
  const tmpDir = _tmp2.default.dirSync();

  _mkdirp2.default.sync(_path2.default.join(tmpDir.name, 'types'));

  const entryFilename = `${ (0, _lodash2.default)(bundleName) }.js`;
  const entryFilePath = _path2.default.join(tmpDir.name, entryFilename);

  return (0, _writers.writeFiles)(tmpDir.name, files, true).then(() => {
    return (0, _rollup.rollup)({
      entry: entryFilePath
    });
  }).then(bundle => {
    return bundle.generate({ format: 'es' });
  }).then(result => {
    return {
      body: result.code,
      path: entryFilename
    };
  });
}