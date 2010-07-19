require.paths.unshift('vendor/jison/lib');

var Parser = require('jison').Parser;

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

