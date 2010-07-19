require.paths.unshift('.');

var fs     = require('fs'),
    parser = require('compiler/grammar').parser;

fs.writeFileSync('./compiler/parser.js', parser.generate());

