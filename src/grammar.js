require.paths.unshift('vendor/jison/lib');

var Parser = require('jison').Parser;

function o(rule, action) {
  return [rule, action || '$$ = $1;'];
}

var grammar = {
  program: [
    o('compstmt', "$$ = {type: 'Program', statements: $1}; return $$;")
  ],

  bodystmt: [
    o('compstmt')
  ],

  compstmt: [
    o('stmts opt_terms', "$$ = $1;")
  ],

  stmts: [
    o('none',             "$$ = [];"),
    o('stmt',             "$$ = [$1];"),
    o('stmts terms stmt', "$1.push($3);")
  ],

  stmt: [
    o('expr')
  ],

  expr: [
    o('arg')
  ],

  expr_value: [
    o('expr')
  ],

  arg: [
    o('arg + arg', "$$ = {type: 'OperatorCall', left: $1, right: $3, op: $2};"),
    o('primary'),
  ],

  arg_value: [
    o('arg')
  ],

  primary: [
    o('literal'),
    o('method_call')
  ],

  primary_value: [
    o('primary')
  ],

  literal: [
    o('tNUMBER', "$$ = {type: 'NumberLiteral', value: $1};")
  ],

  method_call: [
    o('operation paren_args',                      "$$ = {type: 'FunctionCall', name: $1, args: $2};"),
    o('primary . operation2', "$$ = {type: 'MethodCall', receiver: $1, name: $3};")
  ],

  paren_args: [
    o('( none )',             "$$ = [];"),
    o('( call_args opt_nl )', "$$ = $2;")
  ],

  opt_paren_args: [
    o('none'),
    o('paren_args')
  ],

  call_args: [
    o('args opt_block_arg', "$$ = {type: 'CallArgs', args: $1, block_arg: $2};")
  ],

  block_arg: [
    o('tAMPER arg_value')
  ],

  opt_block_arg: [
    o(', block_arg'),
    o('none',      "$$ = null;")
  ],

  args: [
    o('arg_value',        "$$ = [$1];"),
    o('args , arg_value', "$1.push($3);" )
  ],

  operation: [
    o('tIDENTIFIER'),
    o('tCONSTANT'),
    o('tFID')
  ],

  operation2: [
    o('tIDENTIFIER'),
    o('tCONSTANT'),
    o('tFID'),
    o('op')
  ],

  op: [
    o('|'),
    o('^'),
    o('&'),
    o('tCMP'),
    o('tEQ'),
    o('tEQQ'),
    o('tMATCH'),
    o('>'),
    o('tGEQ'),
    o('<'),
    o('tLEQ'),
    o('tLSHFT'),
    o('tRSHFT'),
    o('+'),
    o('-'),
    o('*'),
    o('tSTAR'),
    o('/'),
    o('%'),
    o('tPOW'),
    o('~'),
    o('tUPLUS'),
    o('tUMINUS'),
    o('tAREF'),
    o('tASET'),
    o('`')
  ],

  term: [
    o(';'),
    o('tNEWLINE')
  ],

  terms: [
    o('term'),
    o('terms term')
  ],

  opt_terms: [
    o('none'),
    o('terms')
  ],

  opt_nl: [
    o('none'),
    o('tNEWLINE')
  ],

  none: [
    o('')
  ]
};

var operators = [
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
  [ 'right', '=' ],
  [ 'right', '||=' ],
  [ 'right', '&&=' ],
  [ 'nonassoc', 'kRETURN' ],
  [ 'nonassoc', 'kIF' ],
  [ 'nonassoc', 'kUNLESS' ]
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
  startSymbol: 'program',
  lex: null
});

