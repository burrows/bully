require.paths.unshift('.');

global.puts = require('sys').puts;

var fs     = require('fs'),
    parser = require('src/grammar').parser;
    source = parser.generate({moduleName: 'Bully.parser'});

// clang preprocessor rejects empty single quoted strings
source = source.replace(/''/g, '""');

fs.writeFileSync('./src/parser.js', source);

