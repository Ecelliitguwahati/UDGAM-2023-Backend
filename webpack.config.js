const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
// const HtmlWebPackPlugin = require("html-webpack-plugin");
module.exports = {
  entry: {
    server: "./index.js",
  },
  output: {
    path: path.join(__dirname, "dist"),
    publicPath: "/",
    filename: "index.js",
  },
  target: "node",
  node: {
    // Need this when working with express, otherwise the build fails
    __dirname: false, // if you don't put this is, __dirname
    __filename: false, // and __filename return blank or /
  },
  externals: [nodeExternals()],
}