import loadBabelLibs from '../../../load-babel-libs';
import APIBasedTestFileCompilerBase from '../../api-based';

const BABEL_RUNTIME_RE = /^babel-runtime(\\|\/|$)/;
const FLOW_MARKER_RE   = /^\s*\/\/\s*@flow\s*\n|^\s*\/\*\s*@flow\s*\*\//;

const path = require('path');

const tryRequire = module => {
    let mod;

    try {
        mod = require(module);
    }
    catch (err) {
        /*  */
    }

    return mod;
};

export default class ESNextTestFileCompiler extends APIBasedTestFileCompilerBase {
    static getBabelOptions (filename, code) {
        const { presetStage2, presetFlow, transformRuntime, transformClassProperties, presetEnv } = loadBabelLibs();

        // NOTE: passPrePreset and complex presets is a workaround for https://github.com/babel/babel/issues/2877
        // Fixes https://github.com/DevExpress/testcafe/issues/969
        return {
            passPerPreset: true,
            presets:       [
                {
                    passPerPreset: false,
                    presets:       [{ plugins: [transformRuntime] }, presetStage2, presetEnv]
                },
                FLOW_MARKER_RE.test(code) ? {
                    passPerPreset: false,
                    presets:       [{ plugins: [transformClassProperties] }, presetFlow]
                } : {}
            ],
            filename:      filename,
            retainLines:   true,
            sourceMaps:    'inline',
            ast:           false,
            babelrc:       false,
            highlightCode: false,

            resolveModuleSource: source => {
                if (source === 'testcafe')
                    return APIBasedTestFileCompilerBase.EXPORTABLE_LIB_PATH;

                if (BABEL_RUNTIME_RE.test(source)) {
                    try {
                        return require.resolve(source);
                    }
                    catch (err) {
                        return source;
                    }
                }

                return source;
            }
        };
    }

    canCompile (source, filename) {
        return !!filename.match(/\.ts$|\.js$/);
    }

    _compileCode (code, filename) {
        const babel = require('@babel/core');
        const isTS = /\.ts$/.test(filename);

        let opts = {
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

        const babelTestCafe = tryRequire(path.resolve(process.cwd(), path.join(process.cwd(), './testcafe-babel-config')));

        if (babelTestCafe && babelTestCafe.processOptions) {
            let retVal = babelTestCafe.processOptions(opts);

            // if nothing is returned from the processOption fn we use the
            // original values passed to the function this also means we can
            // modify the opts we pass mutating opts
            if (!retVal)
                retVal = opts;

            opts = retVal;
        }

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
