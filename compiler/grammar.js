var sys = require('sys');

//puts = sys.puts;

require.paths.unshift('vendor/jison/lib');
require.paths.unshift('.');

var Parser = require('jison').Parser,
    Nodes  = require('compiler/nodes').Nodes;

global.Nodes = Nodes;
global.sys = sys;

function o(rule, action) {
  return [rule, action || '$$ = $1;'];
}

var grammar = {
  Root: [
    o('',            'return $$ = new Nodes.Expressions();'),
    o('Expressions', 'return $$ = $1')
  ],

  Expressions: [
    o('Expression',                          '$$ = Nodes.Expressions.wrap([$1]);'),
    o('Expressions Terminator Expression',   '$1.push($3);'),
    o('Expressions Terminator',              '$$ = $1;')
  ],

  Terminator: [
    o(';'),
    o('NEWLINE')
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
    o('NUMBER', '$$ = new Nodes.Literal();'),
    o('STRING', '$$ = new Nodes.Literal();')
  ],

  Call: [
    o('IDENTIFIER ( ArgList )'),
    o('Expression . IDENTIFIER ( ArgList )'),
    o('IDENTIFIER . IDENTIFIER ( ArgList )')
  ],

  ArgList: [
    o(''),
    o('Expression'),
    o('ArgList , Expression')
  ],

  Def: [
    o('DEF IDENTIFIER Terminator Expressions END', '$$ = new Nodes.Def($2, [$4]);'),
    o('DEF IDENTIFIER ( ParamList ) Terminator Expressions END')
  ],
  
  ParamList: [
    o(''),
    o('IDENTIFIER'),
    o('ParamList , IDENTIFIER')
  ],

  Assignment: [
    o('IDENTIFIER = Expression'),
    o('@ IDENTIFIER = Expression'),
    o('CONSTANT = Expression')
  ],

  Class: [
    o('CLASS CONSTANT Terminator Expressions END', '$$ = new Nodes.Class($2, [$4]);')
  ]
};

var operators = [
  ['left',  '.'],
  ['right', 'CLASS'],
  ['right', '=']
];

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

exports.parser = new Parser({
  tokens: tokens,
  bnf: grammar,
  operators: operators.reverse(),
  startSymbol: 'Root',
  lex: null
});

// test
//var fs = require('fs'),
//    sys = require('sys'),
//    Lexer = require('./lexer').Lexer,
//    lexer = new Lexer(),
//    code = fs.readFileSync('./test.bully', 'ascii');

//parser.lexer = {
//  lex: function() {
//    var token = this.tokens[this.pos] || [''];
//    this.pos = this.pos + 1;
//    this.yylineno = token[2];
//    this.yytext = token[1];
//    return token[0];
//  },
//  setInput: function(tokens) {
//    this.tokens = tokens;
//    this.pos = 0;
//  },
//  upcomingInput: function() { return ''; },
//  showPosition: function() { return this.pos; }
//};

//sys.puts(parser.generate());
//sys.puts(sys.inspect(lexer.tokenize(code)));

//var ast = parser.parse(lexer.tokenize(code));
//sys.puts(ast.to_s());
