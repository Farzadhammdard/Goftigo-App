const {mergeConfig} = require('metro-config');
const {getDefaultConfig} = require('expo/metro-config');

const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
