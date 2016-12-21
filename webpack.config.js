const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')

const vendorModules = [
  'bitcoin-core',
  'fs',
  'express',
  'https',
  'pem',
  'body-parser',
  'request',
  'ursa',
  'bcrypt',
  'nodemailer',
  'validator',
  'lodash',
  'md5-file',
]

module.exports = {
  entry: {
    navtech: './src/app.js',
    vendor: vendorModules,
  },
  target: 'node',
  output: {
    path: './dist',
    filename: '[name].js',
  },
  externals: nodeExternals(),
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      mangle: { vars: true },
      // output: { beautify: true },
    }),
  ],
  module: {
    loaders: [
      { test: /\.js$/, loader: 'babel-loader' },
      { test: /\.json$/, loader: 'json' },
      { test: /\.md$/, loader: 'html!markdown' },
      { test: /\.html$/, loader: 'html' },
    ],
  },
}
