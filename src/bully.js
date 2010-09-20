global.Bully = exports.Bully = {};

[ 'lexer',
  'rewriter',
  'eval',
  'class',
  'variable',
  'object',
  'platform',
  'string',
  'error',
  'array',
  'numeric'
].forEach(function(name) { require('./' + name); });

Bully.parser = require('./parser').parser;

Bully.parser.lexer = {
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

Bully.init();

