require.paths.unshift('vendor/jison/lib');

var Parser = require('jison').Parser;

// FIXME: Jison trys to use the deprecated global puts method
global.puts = require('sys').puts;

function o(rule, action) {
  return [rule, action || '$$ = $1;'];
}

var grammar = {
  Root: [
    o('Body', 'return $1')
  ],

  Body: [
    o('',                           "$$ = {type: 'Body', lines: []};"),
    o('Expression',                 "$$ = {type: 'Body', lines: [$1]};"),
    o('Statement',                  "$$ = {type: 'Body', lines: [$1]};"),
    o('Body Terminator Expression', "$1.lines.push($3);"),
    o('Body Terminator Statement',  "$1.lines.push($3);"),
    o('Body Terminator')
  ],

  Terminator: [
    o(';'),
    o('NEWLINE')
  ],

  Statement: [
    o('Return')
  ],

  Expression: [
    o('Literal'),
    o('Assignment'),
    o('Def'),
    o('Class'),
    o('Call'),
    o('If'),
    o('Constant'),
    o('Self')
  ],

  Constant: [
    o('CONSTANT', "$$ = {type: 'Constant', name: $1};"),
  ],

  Self: [
    o('SELF', "$$ = {type: 'Self'}"),
  ],

  Return: [
    o('RETURN Expression', "$$ = {type: 'Return', expression: $2};"),
    o('RETURN',            "$$ = {type: 'Return', expression: null};")
  ],

  Literal: [
    o('NUMBER', "$$ = {type: 'NumberLiteral', value: $1};"),
    o('STRING', "$$ = {type: 'StringLiteral', value: $1};"),
    o('NIL',    "$$ = {type: 'NilLiteral'};"),
    o('TRUE',   "$$ = {type: 'TrueLiteral'};"),
    o('FALSE',  "$$ = {type: 'FalseLiteral'};")
  ],

  Call: [
    o('IDENTIFIER',                          "$$ = {type: 'Call', expression: null, name: $1, argList: null};"),
    o('IDENTIFIER ( ArgList )',              "$$ = {type: 'Call', expression: null, name: $1, argList: $3};"),
    o('Expression . IDENTIFIER',             "$$ = {type: 'Call', expression: $1,   name: $3, argList: null};"),
    o('Expression . IDENTIFIER ( ArgList )', "$$ = {type: 'Call', expression: $1,   name: $3, argList: $5};")
  ],

  If: [
    o('IfStart END'),
    o('IfStart ELSE NEWLINE Body END', '$1.elseBody = $4;'),
  ],

  IfStart: [
    o('IF Expression Then Body', "$$ = {type: 'If', conditions: [$2], bodies: [$4], elseBody: null};"),
    o('IfStart ElsIf',           "$1.conditions = $1.conditions.concat($2.conditions); $1.bodies = $1.bodies.concat($2.bodies);")
  ],

  ElsIf: [
    o('ELSIF Expression Then Body', "$$ = {type: 'If', conditions: [$2], bodies: [$4], elseBody: null};")
  ],

  Then: [
    o('Terminator'),
    o('THEN'),
    o('Terminator THEN')
  ],

  ArgList: [
    o('',                     "$$ = {type: 'ArgList', expressions: []};"),
    o('Expression',           "$$ = {type: 'ArgList', expressions: [$1]};"),
    o('ArgList , Expression', "$1.expressions.push($3);")
  ],

  Def: [
    o('DEF IDENTIFIER Terminator Body END',               "$$ = {type: 'Def', name: $2, params: null, body: $4};"),
    o('DEF IDENTIFIER ( ParamList ) Terminator Body END', "$$ = {type: 'Def', name: $2, params: $4,   body: $7};")
  ],

  ParamList: [
    o('',                                         "$$ = {type: 'ParamList', required: null, optional: null, splat: null};"),
    o('ReqParamList',                             "$$ = {type: 'ParamList', required: $1,   optional: null, splat: null};"),
    o('OptParamList',                             "$$ = {type: 'ParamList', required: null, optional: null, splat: null};"),
    o('SplatParam',                               "$$ = {type: 'ParamList', required: null, optional: null, splat: null};"),
    o('ReqParamList , OptParamList',              "$$ = {type: 'ParamList', required: $1,   optional: $3,   splat: null};"),
    o('ReqParamList , OptParamList , SplatParam', "$$ = {type: 'ParamList', required: $1,   optional: $3,   splat: $5};"),
    o('ReqParamList , SplatParam',                "$$ = {type: 'ParamList', required: $1,   optional: null, splat: $3};"),
    o('OptParamList , SplatParam',                "$$ = {type: 'ParamList', required: null, optional: $1,   splat: $3};")
  ],

  ReqParamList: [
    o('IDENTIFIER',                "$$ = {type: 'ReqParamList', names: [$1]};"),
    o('ReqParamList , IDENTIFIER', "$1.names.push($3);")
  ],

  OptParamList: [
    o('IDENTIFIER = Expression',                "$$ = {type: 'OptParamList', params: [[$1, $3]]};"),
    o('OptParamList , IDENTIFIER = Expression', "$1.params.push([$3, $5]);")
  ],

  SplatParam: [
    o('* IDENTIFIER', "$$ = {type: 'SplatParam', name: $2};")
  ],

  Assignment: [
    o('IDENTIFIER = Expression',     "$$ = {type: 'LocalAssign', name: $1, expression: $3};"),
    o('@ IDENTIFIER = Expression',   "$$ = {type: 'InstanceAssign', name: $2, expression: $4};"),
    o('@ @ IDENTIFIER = Expression', "$$ = {type: 'ClassAssign', name: $3, expression: $5};"),
    o('CONSTANT = Expression',       "$$ = {type: 'ConstantAssign', name: $1, expression: $3};")
  ],

  Class: [
    o('CLASS CONSTANT Terminator Body END',            "$$ = {type: 'Class', constant: $2, super: null, body: $4};"),
    o('CLASS CONSTANT < CONSTANT Terminator Body END', "$$ = {type: 'Class', constant: $2, super: $4, body: $6};")
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

