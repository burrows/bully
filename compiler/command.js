
var sys          = require('sys'),
    fs           = require('fs'),
    opts         = require('./opts'),
    Lexer        = require('./lexer').Lexer,
    parser       = require('./parser').parser,
    selectedOpts = {};

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
    short       : 'c',
    long        : 'compile',
    description : 'Compile the given bully code to javascript',
    callback    : function() { selectedOpts.compile = true; }
  },
  {
    short       : 'h',
    long        : 'help',
    description : 'Show this help message',
    callback    : function() { selectedOpts.help = true; }
  }
];

var lexer = new Lexer();

parser.lexer = {
  lex: function() {
    var token = this.tokens[this.pos] || [''];
    this.pos = this.pos + 1;
    this.yylineno = token[2];
    this.yytext = token[1];
    return token[0];
  },
  setInput: function(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  },
  upcomingInput: function() { return ''; },
  showPosition: function() { return this.pos; }
};

function printTokens(files) {
  files.forEach(function(file) {
    sys.puts(sys.inspect(lexer.tokenize(fs.readFileSync(file, 'ascii'))));
  });
};

function printNodes() {
};

exports.run = function() {
  var files;

  opts.parse(options);

  files = opts.args();

  if (selectedOpts.help)        { opts.help();        }
  else if (selectedOpts.tokens) { printTokens(files); }
  else if (selectedOpts.nodes)  { printNodes(files);  }
};
