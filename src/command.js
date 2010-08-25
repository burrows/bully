
var sys          = require('sys'),
    fs           = require('fs'),
    opts         = require('./opts'),
    Lexer        = require('./lexer').Lexer,
    Nodes        = require('./Nodes').Nodes,
    parser       = require('./parser').parser,
    selectedOpts = {};

global.Nodes = Nodes;

var options = [
  {
    short       : 't',
    long        : 'tokens',
    description : 'Print the tokens produced by the lexer',
    callback    : function() { selectedOpts.tokens = true; }
  },
  {
    short       : 'n',
    long        : 'nodes',
    description : 'Print the parse tree',
    callback    : function() { selectedOpts.nodes = true; }
  },
  {
    short       : 'h',
    long        : 'help',
    description : 'Show this help message',
    callback    : function() { selectedOpts.help = true; }
  }
];

var lexer = new Lexer();


function printTokens(file) {
  sys.puts(sys.inspect(lexer.tokenize(fs.readFileSync(file, 'ascii'))));
};

function printNodes(file) {
  var ast = parser.parse(lexer.tokenize(fs.readFileSync(file, 'ascii')));
  sys.puts(ast.toString());
};

function evaluate(file) {
  var Bully = require('../runtime').Bully, ast;

  ast = parser.parse(lexer.tokenize(fs.readFileSync(file, 'ascii')));
  eval(ast.compile());
};

exports.run = function() {
  var file;

  opts.parse(options);

  file = opts.args()[0];

  if (selectedOpts.help)         { opts.help();       }
  else if (selectedOpts.tokens)  { printTokens(file); }
  else if (selectedOpts.nodes)   { printNodes(file);  }
  else                           { evaluate(file);    }
};
