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
    o('',                           '$$ = Bully.Nodes.Body.create();'),
    o('Expression',                 '$$ = Bully.Nodes.Body.wrap([$1]);'),
    o('Statement',                  '$$ = Bully.Nodes.Body.wrap([$1]);'),
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
    o('Constant'),
    o('Self')
  ],

  Constant: [
    o('CONSTANT', '$$ = Bully.Nodes.Constant.create($1);'),
  ],

  Self: [
    o('SELF', '$$ = Bully.Nodes.Self.create();'),
  ],

  Return: [
    o('RETURN Expression', '$$ = Bully.Nodes.Return.create([$2]);'),
    o('RETURN',            '$$ = Bully.Nodes.Return.create();')
  ],

  Literal: [
    o('NUMBER', '$$ = Bully.Nodes.Literal.create("NUMBER", $1);'),
    o('STRING', '$$ = Bully.Nodes.Literal.create("STRING", $1);'),
    o('NIL',    '$$ = Bully.Nodes.Literal.create("NIL");'),
    o('TRUE',   '$$ = Bully.Nodes.Literal.create("TRUE");'),
    o('FALSE',  '$$ = Bully.Nodes.Literal.create("FALSE");')
  ],

  Call: [
    o('IDENTIFIER',                          '$$ = Bully.Nodes.Call.create(null, $1, null);'),
    o('IDENTIFIER ( ArgList )',              '$$ = Bully.Nodes.Call.create(null, $1, $3);'),
    o('Expression . IDENTIFIER',             '$$ = Bully.Nodes.Call.create($1, $3, null);'),
    o('Expression . IDENTIFIER ( ArgList )', '$$ = Bully.Nodes.Call.create($1, $3, $5);')
  ],

  If: [
    o('IfStart END'),
    o('IfStart ELSE NEWLINE Body END', '$1.addElse($4.needsReturn());'),
  ],

  IfStart: [
    o('IF Expression Then Body', '$$ = Bully.Nodes.If.create([$2, $4.needsReturn()]);'),
    o('IfStart ElsIf',           '$1.push($2);')
  ],

  ElsIf: [
    o('ELSIF Expression Then Body', '$$ = Bully.Nodes.If.create([$2, $4.needsReturn()]);')
  ],

  Then: [
    o('Terminator'),
    o('THEN'),
    o('Terminator THEN')
  ],

  ArgList: [
    o('',                     '$$ = Bully.Nodes.ArgList.create();'),
    o('Expression',           '$$ = Bully.Nodes.ArgList.create([$1]);'),
    o('ArgList , Expression', '$1.push($3);')
  ],

  Def: [
    o('DEF IDENTIFIER Terminator Body END',               '$$ = Bully.Nodes.Def.create($2, Bully.Nodes.ParamList.create(), $4.needsReturn());'),
    o('DEF IDENTIFIER ( ParamList ) Terminator Body END', '$$ = Bully.Nodes.Def.create($2, $4, $7.needsReturn());'),
  ],

  ParamList: [
    o('',                                         '$$ = Bully.Nodes.ParamList.create();'),
    o('ReqParamList',                             '$$ = Bully.Nodes.ParamList.create([$1]);'),
    o('OptParamList',                             '$$ = Bully.Nodes.ParamList.create([$1]);'),
    o('SplatParam',                               '$$ = Bully.Nodes.ParamList.create([$1]);'),
    o('ReqParamList , OptParamList',              '$$ = Bully.Nodes.ParamList.create([$1, $3]);'),
    o('ReqParamList , OptParamList , SplatParam', '$$ = Bully.Nodes.ParamList.create([$1, $3, $5]);'),
    o('ReqParamList , SplatParam',                '$$ = Bully.Nodes.ParamList.create([$1, $3]);'),
    o('OptParamList , SplatParam',                '$$ = Bully.Nodes.ParamList.create([$1, $3]);')
  ],

  ReqParamList: [
    o('IDENTIFIER',                '$$ = Bully.Nodes.ReqParamList.create($1);'),
    o('ReqParamList , IDENTIFIER', '$1.push($3);')
  ],

  OptParamList: [
    o('IDENTIFIER = Expression',                '$$ = Bully.Nodes.OptParamList.create($1, $3);'),
    o('OptParamList , IDENTIFIER = Expression', '$1.push($3, $5);')
  ],

  SplatParam: [
    o('* IDENTIFIER', '$$ = Bully.Nodes.SplatParam.create($2);')
  ],

  Assignment: [
    o('IDENTIFIER = Expression',     '$$ = Bully.Nodes.LocalAssign.create($1, $3);'),
    o('@ IDENTIFIER = Expression',   '$$ = Bully.Nodes.InstanceAssign.create($2, $4);'),
    o('@ @ IDENTIFIER = Expression', '$$ = Bully.Nodes.ClassAssign.create($3, $5);'),
    o('CONSTANT = Expression',       '$$ = Bully.Nodes.ConstantAssign.create($1, $3);')
  ],

  Class: [
    o('CLASS CONSTANT Terminator Body END',            '$$ = Bully.Nodes.Class.create($2, null, [$4]);'),
    o('CLASS CONSTANT < CONSTANT Terminator Body END', '$$ = Bully.Nodes.Class.create($2, $4, [$6]);')
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

