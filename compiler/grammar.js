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
    o('',                           '$$ = Nodes.Body.create();'),
    o('Expression',                 '$$ = Nodes.Body.wrap([$1]);'),
    o('Statement',                  '$$ = Nodes.Body.wrap([$1]);'),
    o('Body Terminator Expression', '$1.push($3);'),
    o('Body Terminator Statement',  '$1.push($3);'),
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
    o('CONSTANT')
  ],

  Return: [
    o('RETURN Expression', '$$ = Nodes.Return.create([$2]);'),
    o('RETURN',            '$$ = Nodes.Return.create();')
  ],

  Literal: [
    o('NUMBER', '$$ = Nodes.Literal.create("NUMBER", $1);'),
    o('STRING', '$$ = Nodes.Literal.create("STRING", $1);'),
    o('NIL',    '$$ = Nodes.Literal.create("NIL");'),
    o('TRUE',   '$$ = Nodes.Literal.create("TRUE");'),
    o('FALSE',  '$$ = Nodes.Literal.create("FALSE");')
  ],

  Call: [
    o('IDENTIFIER',                          '$$ = Nodes.Call.create(null, $1, null);'),
    o('IDENTIFIER ( ArgList )',              '$$ = Nodes.Call.create(null, $1, $3);'),
    o('Expression . IDENTIFIER',             '$$ = Nodes.Call.create($1, $3, null);'),
    o('Expression . IDENTIFIER ( ArgList )', '$$ = Nodes.Call.create($1, $3, $5);')
  ],

  If: [
    o('IfStart END'),
    o('IfStart ELSE NEWLINE Body END', '$1.addElse($4.needsReturn());'),
  ],

  IfStart: [
    o('IF Expression Then Body', '$$ = Nodes.If.create([$2, $4.needsReturn()]);'),
    o('IfStart ElsIf',           '$1.push($2);')
  ],

  ElsIf: [
    o('ELSIF Expression Then Body', '$$ = Nodes.If.create([$2, $4.needsReturn()]);')
  ],

  Then: [
    o('Terminator'),
    o('THEN'),
    o('Terminator THEN')
  ],

  ArgList: [
    o('',                     '$$ = Nodes.ArgList.create();'),
    o('Expression',           '$$ = Nodes.ArgList.create([$1]);'),
    o('ArgList , Expression', '$1.push($3);')
  ],

  Def: [
    o('DEF IDENTIFIER Terminator Body END',               '$$ = Nodes.Def.create($2, Nodes.ParamList.create(), $4.needsReturn());'),
    o('DEF IDENTIFIER ( ParamList ) Terminator Body END', '$$ = Nodes.Def.create($2, $4, $7.needsReturn());'),
  ],

  ParamList: [
    o('',                                         '$$ = Nodes.ParamList.create();'),
    o('ReqParamList',                             '$$ = Nodes.ParamList.create([$1]);'),
    o('OptParamList',                             '$$ = Nodes.ParamList.create([$1]);'),
    o('SplatParam',                               '$$ = Nodes.ParamList.create([$1]);'),
    o('ReqParamList , OptParamList',              '$$ = Nodes.ParamList.create([$1, $3]);'),
    o('ReqParamList , OptParamList , SplatParam', '$$ = Nodes.ParamList.create([$1, $3, $5]);'),
    o('ReqParamList , SplatParam',                '$$ = Nodes.ParamList.create([$1, $3]);'),
    o('OptParamList , SplatParam',                '$$ = Nodes.ParamList.create([$1, $3]);')
  ],

  ReqParamList: [
    o('IDENTIFIER',                '$$ = Nodes.ReqParamList.create($1);'),
    o('ReqParamList , IDENTIFIER', '$1.push($3);')
  ],

  OptParamList: [
    o('IDENTIFIER = Expression',                '$$ = Nodes.OptParamList.create($1, $3);'),
    o('OptParamList , IDENTIFIER = Expression', '$1.push($3, $5);')
  ],

  SplatParam: [
    o('* IDENTIFIER', '$$ = Nodes.SplatParam.create($2);')
  ],

  Assignment: [
    o('IDENTIFIER = Expression',     '$$ = Nodes.LocalAssign.create($1, $3);'),
    o('@ IDENTIFIER = Expression',   '$$ = Nodes.InstanceAssign.create($2, $4);'),
    o('@ @ IDENTIFIER = Expression', '$$ = Nodes.ClassAssign.create($3, $5);'),
    o('CONSTANT = Expression',       '$$ = Nodes.ConstantAssign.create($1, $3);')
  ],

  Class: [
    o('CLASS CONSTANT Terminator Body END',            '$$ = Nodes.Class.create($2, null, [$4]);'),
    o('CLASS CONSTANT < CONSTANT Terminator Body END', '$$ = Nodes.Class.create($2, $4, [$6]);')
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

