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
    o('ArrayLiteral'),
    o('HashLiteral'),
    o('Assignment'),
    o('VariableRef'),
    o('Def'),
    o('Class'),
    o('Call'),
    o('Operation'),
    o('Logical'),
    o('If'),
    o('Self'),
    o('BeginBlock')
  ],

  Self: [
    o('SELF', "$$ = {type: 'Self'}")
  ],

  Return: [
    o('RETURN Expression', "$$ = {type: 'Return', expression: $2};"),
    o('RETURN',            "$$ = {type: 'Return', expression: null};")
  ],

  Literal: [
    o('NUMBER', "$$ = {type: 'NumberLiteral', value: $1};"),
    o('STRING', "$$ = {type: 'StringLiteral', value: $1};"),
    o('SYMBOL', "$$ = {type: 'SymbolLiteral', value: $1};"),
    o('NIL',    "$$ = {type: 'NilLiteral'};"),
    o('TRUE',   "$$ = {type: 'TrueLiteral'};"),
    o('FALSE',  "$$ = {type: 'FalseLiteral'};")
  ],

  Call: [
    o('IDENTIFIER OptBlock',                             "$$ = {type: 'Call', expression: null, name: $1,    args: null, block: $2};"),
    o('IDENTIFIER ( ArgList ) OptBlock',                 "$$ = {type: 'Call', expression: null, name: $1,    args: $3,   block: $5};"),
    o('Expression . IDENTIFIER OptBlock',                "$$ = {type: 'Call', expression: $1,   name: $3,    args: null, block: $4};"),
    o('Expression . IDENTIFIER ( ArgList ) OptBlock',    "$$ = {type: 'Call', expression: $1,   name: $3,    args: $5,   block: $7};"),
    o('Expression [ Expression ]',                       "$$ = {type: 'Call', expression: $1,   name: '[]',  args: [$3], block: null};"),
    o('Expression [ Expression ] = Expression',          "$$ = {type: 'Call', expression: $1,   name: '[]=', args: [$3, $6], block: null};"),
    o('SUPER OptBlock',                                  "$$ = {type: 'SuperCall', args: null, block: $2};"),
    o('SUPER ( ArgList ) OptBlock',                      "$$ = {type: 'SuperCall', args: $3,   block: $5};"),
    o('YIELD',                                           "$$ = {type: 'YieldCall', args: null};"),
    o('YIELD ( ArgList )',                               "$$ = {type: 'YieldCall', args: $3};")
  ],

  Operation: [
    o('Expression ** Expression',  "$$ = {type: 'Call', expression: $1, name: '**',  args: [$3], block: null};"),
    o('! Expression',              "$$ = {type: 'Call', expression: $2, name: '!',   args: null, block: null};"),
    o('~ Expression',              "$$ = {type: 'Call', expression: $2, name: '~',   args: null, block: null};"),
    o('+ Expression',              "$$ = {type: 'Call', expression: $2, name: '+@',  args: null, block: null};"),
    o('- Expression',              "$$ = {type: 'Call', expression: $2, name: '-@',  args: null, block: null};"),
    o('Expression * Expression',   "$$ = {type: 'Call', expression: $1, name: '*',   args: [$3], block: null};"),
    o('Expression / Expression',   "$$ = {type: 'Call', expression: $1, name: '/',   args: [$3], block: null};"),
    o('Expression % Expression',   "$$ = {type: 'Call', expression: $1, name: '%',   args: [$3], block: null};"),
    o('Expression + Expression',   "$$ = {type: 'Call', expression: $1, name: '+',   args: [$3], block: null};"),
    o('Expression - Expression',   "$$ = {type: 'Call', expression: $1, name: '-',   args: [$3], block: null};"),
    o('Expression << Expression',  "$$ = {type: 'Call', expression: $1, name: '<<',  args: [$3], block: null};"),
    o('Expression >> Expression',  "$$ = {type: 'Call', expression: $1, name: '>>',  args: [$3], block: null};"),
    o('Expression & Expression',   "$$ = {type: 'Call', expression: $1, name: '&',   args: [$3], block: null};"),
    o('Expression ^ Expression',   "$$ = {type: 'Call', expression: $1, name: '^',   args: [$3], block: null};"),
    o('Expression | Expression',   "$$ = {type: 'Call', expression: $1, name: '|',   args: [$3], block: null};"),
    o('Expression <= Expression',  "$$ = {type: 'Call', expression: $1, name: '<=',  args: [$3], block: null};"),
    o('Expression < Expression',   "$$ = {type: 'Call', expression: $1, name: '<',   args: [$3], block: null};"),
    o('Expression > Expression',   "$$ = {type: 'Call', expression: $1, name: '>',   args: [$3], block: null};"),
    o('Expression >= Expression',  "$$ = {type: 'Call', expression: $1, name: '>=',  args: [$3], block: null};"),
    o('Expression <=> Expression', "$$ = {type: 'Call', expression: $1, name: '<=>', args: [$3], block: null};"),
    o('Expression == Expression',  "$$ = {type: 'Call', expression: $1, name: '==',  args: [$3], block: null};"),
    o('Expression === Expression', "$$ = {type: 'Call', expression: $1, name: '===', args: [$3], block: null};"),
    o('Expression != Expression',  "$$ = {type: 'Call', expression: $1, name: '!=',  args: [$3], block: null};"),
    o('Expression =~ Expression',  "$$ = {type: 'Call', expression: $1, name: '=~',  args: [$3], block: null};"),
    o('Expression !~ Expression',  "$$ = {type: 'Call', expression: $1, name: '!~',  args: [$3], block: null};")
  ],

  Logical: [
    o('Expression && Expression', "$$ = {type: 'Logical', operator: '&&', expressions: [$1, $3]};"),
    o('Expression || Expression', "$$ = {type: 'Logical', operator: '||', expressions: [$1, $3]};")
  ],

  Block: [
    o('DO | BlockParamList | Body END', "$$ = {type: 'Block', params: $3, body: $5};"),
    o('DO Body END', "$$ = {type: 'Block', params: null, body: $2};"),
    o('{ | BlockParamList | Body }', "$$ = {type: 'Block', params: $3, body: $5};"),
    o('{ Body }', "$$ = {type: 'Block', params: null, body: $2};")
  ],

  OptBlock: [
    o('', "$$ = null;"),
    o('Block')
  ],

  If: [
    o('IfStart END'),
    o('IfStart ELSE NEWLINE Body END', '$1.else_body = $4;')
  ],

  IfStart: [
    o('IF Expression Then Body', "$$ = {type: 'If', conditions: [$2], bodies: [$4], else_body: null};"),
    o('IfStart ElsIf',           "$1.conditions = $1.conditions.concat($2.conditions); $1.bodies = $1.bodies.concat($2.bodies);")
  ],

  ElsIf: [
    o('ELSIF Expression Then Body', "$$ = {type: 'If', conditions: [$2], bodies: [$4], else_body: null};")
  ],

  Then: [
    o('Terminator'),
    o('THEN'),
    o('Terminator THEN')
  ],

  ArgList: [
    o('',                     "$$ = [];"),
    o('Expression',           "$$ = [$1];"),
    o('ArgList , Expression', "$1.push($3);")
  ],

  ArrayLiteral: [
    o('[ ArgList ]', "$$ = {type: 'ArrayLiteral', expressions: $2};")
  ],

  AssocList: [
    o('',                                     "$$ = {type: 'AssocList', keys: [], values: []};" ),
    o('Expression => Expression',             "$$ = {type: 'AssocList', keys: [$1], values: [$3]};"  ),
    o('AssocList , Expression => Expression', "$1.keys.push($3); $1.values.push($5);" )
  ],

  HashLiteral: [
    o('{ AssocList }', "$$ = {type: 'HashLiteral', keys: $2.keys, values: $2.values};")
  ],

  Def: [
    o('DEF IDENTIFIER Terminator Body END',                      "$$ = {type: 'Def', name: $2, params: null, body: $4, singleton: false};"),
    o('DEF IDENTIFIER ( ParamList ) Terminator Body END',        "$$ = {type: 'Def', name: $2, params: $4,   body: $7, singleton: false};"),
    o('DEF SELF . IDENTIFIER Terminator Body END',               "$$ = {type: 'Def', name: $4, params: null, body: $6, singleton: true};"),
    o('DEF SELF . IDENTIFIER ( ParamList ) Terminator Body END', "$$ = {type: 'Def', name: $4, params: $6,   body: $9, singleton: true};")
  ],

  BlockParamList: [
    o('',                          "$$ = {type: 'BlockParamList', required: [], splat: null};"),
    o('ReqParamList',              "$$ = {type: 'BlockParamList', required: $1, splat: null};"),
    o('ReqParamList , SplatParam', "$$ = {type: 'BlockParamList', required: $1, splat: $3};")
  ],

  ParamList: [
    o('',                                         "$$ = {type: 'ParamList', required: [], optional: [], splat: null};"),
    o('ReqParamList',                             "$$ = {type: 'ParamList', required: $1, optional: [], splat: null};"),
    o('OptParamList',                             "$$ = {type: 'ParamList', required: [], optional: [], splat: null};"),
    o('SplatParam',                               "$$ = {type: 'ParamList', required: [], optional: [], splat: $1};"),
    o('ReqParamList , OptParamList',              "$$ = {type: 'ParamList', required: $1, optional: $3, splat: null};"),
    o('ReqParamList , OptParamList , SplatParam', "$$ = {type: 'ParamList', required: $1, optional: $3, splat: $5};"),
    o('ReqParamList , SplatParam',                "$$ = {type: 'ParamList', required: $1, optional: [], splat: $3};"),
    o('OptParamList , SplatParam',                "$$ = {type: 'ParamList', required: [], optional: $1, splat: $3};")
  ],

  ReqParamList: [
    o('IDENTIFIER',                "$$ = [$1];"),
    o('ReqParamList , IDENTIFIER', "$1.push($3);")
  ],

  OptParamList: [
    o('IDENTIFIER = Expression',                "$$ = [{name: $1, expression: $3}];"),
    o('OptParamList , IDENTIFIER = Expression', "$1.push({name: $3, expression: $5});")
  ],

  SplatParam: [
    o('* IDENTIFIER', "$$ = $2;")
  ],

  Assignment: [
    o('IDENTIFIER = Expression',     "$$ = {type: 'LocalAssign',    name: $1,        expression: $3};"),
    o('@ IDENTIFIER = Expression',   "$$ = {type: 'InstanceAssign', name: '@' + $2,  expression: $4};"),
    o('@ @ IDENTIFIER = Expression', "$$ = {type: 'ClassAssign',    name: '@@' + $3, expression: $5};"),
    o('CONSTANT = Expression',       "$$ = {type: 'ConstantAssign', name: $1,        expression: $3};")
  ],

  VariableRef: [
    o('@ IDENTIFIER',   "$$ = {type: 'InstanceRef', name: '@' + $2};"),
    o('@ @ IDENTIFIER', "$$ = {type: 'ClassRef',    name: '@@' + $3};"),
    o('ConstantRef')
  ],

  ConstantRef: [
    o('CONSTANT', "$$ = {type: 'ConstantRef', name: $1};")
  ],

  Class: [
    o('CLASS CONSTANT Terminator Body END',              "$$ = {type: 'Class', name: $2, super_expr: null, body: $4};"),
    o('CLASS CONSTANT < Expression Terminator Body END', "$$ = {type: 'Class', name: $2, super_expr: $4, body: $6};")
  ],

  BeginBlock: [
    o('BEGIN Body RescueBlocks EnsureBlock END', "$$ = {type: 'BeginBlock', body: $2, rescues: $3, ensure: $4};"),
    o('BEGIN Body EnsureBlock END',              "$$ = {type: 'BeginBlock', body: $2, rescues: [], ensure: $3};"),
    o('BEGIN Body RescueBlocks END',             "$$ = {type: 'BeginBlock', body: $2, rescues: $3, ensure: null};"),
    o('BEGIN Body END',                          "$$ = {type: 'BeginBlock', body: $2, rescues: [], ensure: null};")
  ],

  RescueBlocks: [
    o('RescueBlock',              "$$ = [$1];"),
    o('RescueBlocks RescueBlock', "$1.push($2);")
  ],

  RescueBlock: [
    o('RESCUE Do Body',                              "$$ = {type: 'RescueBlock', exception_types: [], name: null, body: $3};"),
    o('RESCUE ExceptionTypes Do Body',               "$$ = {type: 'RescueBlock', exception_types: $2, name: null, body: $4};"),
    o('RESCUE ExceptionTypes => IDENTIFIER Do Body', "$$ = {type: 'RescueBlock', exception_types: $2, name: $4,   body: $6};")
  ],

  ExceptionTypes: [
    o('ConstantRef',                  "$$ = [$1];"),
    o('ExceptionTypes , ConstantRef', "$1.push($3);")
  ],

  EnsureBlock: [
    o('ENSURE Body', "$$ = {type: 'EnsureBlock', body: $2};")
  ],

  Do: [
    o('Terminator'),
    o('DO'),
    o('Terminator DO')
  ]
};

var operators = [
  [ 'left',  '[' ],
  [ 'left',  ']' ],

  [ 'left',  '**' ],
  [ 'right', '!' ],
  [ 'right', '~' ],
  [ 'left',  '*' ],
  [ 'left',  '/' ],
  [ 'left',  '%' ],
  [ 'left',  '+' ],
  [ 'left',  '-' ],
  [ 'left',  '<<' ],
  [ 'left',  '>>' ],
  [ 'left',  '&' ],
  [ 'left',  '^' ],
  [ 'left',  '|' ],
  [ 'left',  '<=' ],
  [ 'left',  '<' ],
  [ 'left',  '>' ],
  [ 'left',  '>=' ],
  [ 'left',  '<=>' ],
  [ 'left',  '==' ],
  [ 'left',  '===' ],
  [ 'left',  '!=' ],
  [ 'left',  '=~' ],
  [ 'left',  '!~' ],
  [ 'left',  '&&' ],
  [ 'left',  '||' ],

  [ 'left',  '.' ],
  [ 'right', 'CLASS' ],
  [ 'right', '=' ],
  [ 'right', 'RETURN' ]
];

var tokens = [], name, symbols, token, i, j;
for (name in grammar) {
  if (!grammar.hasOwnProperty(name)) { continue; }

  for (i = 0; i < grammar[name].length; i += 1) {
    symbols = grammar[name][i][0].split(' ');

    for (j = 0; j < symbols.length; j += 1) {
      token = symbols[j];
      if (!grammar[token] && tokens.indexOf(token) === -1) {
        tokens.push(token);
      }
    }
  }
}

exports.parser = new Parser({
  tokens: tokens,
  bnf: grammar,
  operators: operators.reverse(),
  startSymbol: 'Root',
  lex: null
});

