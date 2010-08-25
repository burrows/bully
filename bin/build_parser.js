require.paths.unshift('.');

var fs     = require('fs'),
    parser = require('src/grammar').parser;

fs.writeFileSync('./src/parser.js', parser.generate());

