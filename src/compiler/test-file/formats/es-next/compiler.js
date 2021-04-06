import loadBabelLibs from '../../../babel/load-libs';
import APIBasedTestFileCompilerBase from '../../api-based';
import isFlowCode from './is-flow-code';
import BASE_BABEL_OPTIONS from '../../../babel/get-base-babel-options';

// const path = require('path');

// const tryRequire = module => {
//     let mod;

//     try {
//         mod = require(module);
//     }
//     catch (err) {
//         /*  */
//     }

//     return mod;
// };

export default class ESNextTestFileCompiler extends APIBasedTestFileCompilerBase {
    static getBabelOptions (filename, code) {
        const {
            presetStage2,
            presetFlow,
            transformRuntime,
            presetEnvForTestCode,
            presetReact,
            moduleResolver
        } = loadBabelLibs();

        const opts = Object.assign({}, BASE_BABEL_OPTIONS, {
            presets:    [presetStage2, presetEnvForTestCode, presetReact],
            plugins:    [transformRuntime, moduleResolver],
            sourceMaps: 'inline',
            filename
        });

        if (isFlowCode(code))
            opts.presets.push(presetFlow);

        return opts;
    }

    canCompile (source, filename) {
        return !!filename.match(/\.ts$|\.js$/);
    }

    _compileCode (code, filename) {
        const babel = require('@babel/core');
        const isTS = /\.ts$/.test(filename);

        const opts = {
            filename:      filename,
            retainLines:   true,
            sourceMaps:    'inline',
            ast:           false,
            babelrc:       false,
            configFile:    false,
            highlightCode: false,
            presets:       [
                [
                    '@babel/preset-env',
                    {
                        loose:   true,
                        targets: {
                            node: '6',
                        },
                    },
                ],
                isTS ? '@babel/preset-typescript' : '@babel/preset-flow',
                '@babel/preset-react',
            ],
            plugins: [
                ['module-resolver', {
                    'resolvePath': source => {
                        if (source === 'testcafe')
                            return APIBasedTestFileCompilerBase.EXPORTABLE_LIB_PATH;
                        return source;
                    }
                }],
                [
                    '@babel/plugin-proposal-decorators',
                    {
                        legacy: true,
                    },
                ],
                [
                    '@babel/plugin-proposal-class-properties',
                    {
                        loose: true,
                    },
                ],
                '@babel/plugin-transform-runtime',
                '@babel/plugin-proposal-do-expressions',
                '@babel/plugin-proposal-export-default-from',
                '@babel/plugin-proposal-export-namespace-from',
                '@babel/plugin-proposal-object-rest-spread',
                '@babel/plugin-proposal-optional-chaining',
                '@babel/plugin-proposal-nullish-coalescing-operator',
            ],
            ignore: ['node_modules/**/*.js'],
        };

        if (this.cache[filename])
            return this.cache[filename];

        const compiled = babel.transform(code, opts);

        this.cache[filename] = compiled.code;

        return compiled.code;

    }

    _getRequireCompilers () {
        return {
            '.ts': (code, filename) => this._compileCode(code, filename),
            '.js': (code, filename) => this._compileCode(code, filename)
        };
    }

    getSupportedExtension () {
        return ['.js', '.ts'];
    }
}
