// Rspack config for the shell — Module Federation 2.0 HOST.
// Uses @module-federation/enhanced/rspack (MF 2.0). NOT Vite-federation,
// NOT Next.js+MF. React/React-Router/Query are shared singletons so the host
// and the mfe-learner remote share one instance.
const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const path = require('node:path');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.SHELL_PORT || 4200);
const LEARNER_REMOTE =
  process.env.MFE_LEARNER_REMOTE || 'http://localhost:4201/mf-manifest.json';

const deps = require('./package.json').dependencies;
const shared = {
  react: { singleton: true, requiredVersion: deps.react },
  'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
  'react-router-dom': { singleton: true, requiredVersion: deps['react-router-dom'] },
  '@tanstack/react-query': { singleton: true, requiredVersion: deps['@tanstack/react-query'] },
};

/** @type {import('@rspack/core').Configuration} */
module.exports = {
  mode: isDev ? 'development' : 'production',
  context: __dirname,
  entry: './src/main.ts',
  devtool: isDev ? 'source-map' : false,
  output: {
    path: path.resolve(__dirname, 'dist'),
    // Absolute publicPath so host assets resolve from root at any route depth
    // (e.g. /auth/callback must still load /main.js, not /auth/main.js).
    publicPath: '/',
    uniqueName: 'shell',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@lingua/contracts': path.resolve(__dirname, '../../libs/contracts/src/index.ts'),
    },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic', development: isDev, refresh: false } },
          },
        },
      },
      { test: /\.css$/, type: 'css' },
      // SCSS Modules (*.module.scss → scoped class names) and plain *.scss.
      {
        test: /\.module\.scss$/,
        type: 'css/module',
        // Expose the class map as a default export (`import styles from '...'`).
        parser: { namedExports: false },
        use: [{ loader: 'sass-loader' }],
      },
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/,
        type: 'css',
        use: [{ loader: 'sass-loader' }],
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ template: './src/index.html' }),
    new rspack.DefinePlugin({
      'process.env.BFF_URL': JSON.stringify(process.env.BFF_URL || 'http://localhost:3000'),
    }),
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        mfe_learner: `mfe_learner@${LEARNER_REMOTE}`,
      },
      shared,
    }),
  ],
  devServer: {
    port: PORT,
    historyApiFallback: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  experiments: { css: true },
};
