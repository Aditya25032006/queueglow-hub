const path = require('node:path');
const { build } = require('../package.json');

module.exports = {
  ...build,
  electronDownload: {
    cache: path.resolve(__dirname, '..', '.cache', 'electron'),
  },
};
