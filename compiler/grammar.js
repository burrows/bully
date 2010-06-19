var sys = require('sys');

puts = sys.puts;

require.paths.unshift('vendor/jison/lib');

var Parser = require('jison').Parser;

function o(rule) {
  return [rule, 'puts("' + rule + '");'];
}

var grammar = {
  Root: [
    o('Expressions')
  ],

  Terminator: [
    o(';'),
    o('NEWLINE')
  ],

  Expressions: [
    o(''),
    o('Expression'),
    o('Expressions Terminator Expression'),
    o('Expressions Terminator')
  ],

  Expression: [
    o('Literal'),
    o('Assignment'),
    o('Def'),
    o('Class'),
    o('Call'),
    o('CONSTANT'),
    o('TRUE'),
    o('FALSE'),
    o('NIL')
  ],

  Literal: [
    o('NUMBER'),
    o('STRING')
  ],

  Assignment: [
    o('IDENTIFIER = Expression'),
    o('CONSTANT = Expression')
  ],

  Def: [
    o('DEF IDENTIFIER Terminator Expressions END'),
    o('DEF IDENTIFIER ( ParamList ) Terminator Expressions END')
  ],

  Class: [
    o('CLASS CONSTANT Terminator Expressions END')
  ],

  Call: [
    o('IDENTIFIER'),
    o('IDENTIFIER ( ArgList )'),
    o('Expression . IDENTIFIER'),
    o('Expression . IDENTIFIER ( ArgList )')
  ],

  ArgList: [
    o(''),
    o('Expression'),
    o('ArgList , Expression')
  ],

  ParamList: [
    o(''),
    o('IDENTIFIER'),
    o('ParamList , IDENTIFIER')
  ]
};

var operators = [];

var tokens = [], name, alt, token;
var sys = require('sys');
for (name in grammar) {
  if (!grammar.hasOwnProperty(name)) { continue; }

  grammar[name].forEach(function(alt) {
    alt[0].split(' ').forEach(function(token) {
      if (!grammar[token] && tokens.indexOf(token) === -1) { tokens.push(token); }
    });
  });
}

sys.puts(sys.inspect(tokens));

var parser = new Parser({
  tokens: tokens,
  bnf: grammar,
  operators: operators,
  startSymbol: 'Root',
  lex: null
});

// test
var fs = require('fs'),
    sys = require('sys'),
    Lexer = require('./lexer').Lexer,
    lexer = new Lexer(),
    code = fs.readFileSync('./test.rb', 'ascii');

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

sys.puts(sys.inspect(lexer.tokenize(code)));

parser.parse(lexer.tokenize(code));
