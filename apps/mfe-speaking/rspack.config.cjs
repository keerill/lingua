// Rspack config for mfe-speaking — Module Federation 2.0 REMOTE.
// Exposes ./SpeakingApp; shares React/Router/Query as singletons with the host.
const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const path = require('node:path');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.MFE_SPEAKING_PORT || 4202);

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
    publicPath: 'auto',
    uniqueName: 'mfe_speaking',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
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
      {
        test: /\.module\.scss$/,
        type: 'css/module',
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
      name: 'mfe_speaking',
      filename: 'remoteEntry.js',
      exposes: {
        './SpeakingApp': './src/SpeakingApp.tsx',
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
