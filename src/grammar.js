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

  primary: [
    o('literal'),
    o('xstring'),
    o('method_call'),
    o('kDEF fname f_arglist bodystmt kEND', "$$ = {type: 'Def', name: $2, params: $3, body: $4};")
  ],

  fname: [
    o('tIDENTIFIER'),
    o('tCONSTANT'),
    o('tFID'),
    o('op'),
    o('reswords')
  ],

  reswords: [
    o('kAND'),
    o('kBEGIN'),
    o('kBREAK'),
    o('kCASE'),
    o('kCLASS'),
    o('kDEF'),
    o('kDEFINED'),
    o('kDO'),
    o('kELSE'),
    o('kELSIF'),
    o('kEND'),
    o('kENSURE'),
    o('kFALSE'),
    o('kFOR'),
    o('kIN'),
    o('kMODULE'),
    o('kNEXT'),
    o('kNIL'),
    o('kNOT'),
    o('kOR'),
    o('kREDO'),
    o('kRESCUE'),
    o('kRETRY'),
    o('kRETURN'),
    o('kSELF'),
    o('kSUPER'),
    o('kTHEN'),
    o('kTRUE'),
    o('kUNDEF'),
    o('kWHEN'),
    o('kYIELD'),
    o('kIF_MOD'),
    o('kUNLESS_MOD'),
    o('kWHILE_MOD'),
    o('kUNTIL_MOD'),
    o('kRESCUE_MOD')
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
    o('tAMPER arg')
  ],

  opt_block_arg: [
    o(', block_arg'),
    o('none',      "$$ = null;")
  ],

  args: [
    o('arg',        "$$ = [$1];"),
    o('args , arg', "$1.push($3);" )
  ],

  f_arglist: [
    o('( f_args opt_nl )', "$$ = $2;"),
    o('f_args term',       "$$ = $1;")
  ],

  f_args: [
    o('f_arg , f_optarg , f_rest_arg opt_f_block_arg', "$$ = {type: 'ParamList', required: $1, optional: $3, splat: $5,   block: $6};"),
    o('f_arg , f_optarg opt_f_block_arg',              "$$ = {type: 'ParamList', required: $1, optional: $3, splat: null, block: $4};"),
    o('f_arg , f_rest_arg opt_f_block_arg',            "$$ = {type: 'ParamList', required: $1, optional: [], splat: $3,   block: $4};"),
    o('f_arg opt_f_block_arg',                         "$$ = {type: 'ParamList', required: [], optional: [], splat: null, block: $2};"),
    o('f_optarg , f_rest_arg opt_f_block_arg',         "$$ = {type: 'ParamList', required: [], optional: $1, splat: $3,   block: $4};"),
    o('f_optarg opt_f_block_arg',                      "$$ = {type: 'ParamList', required: [], optional: $1, splat: null, block: $2};"),
    o('f_rest_arg opt_f_block_arg',                    "$$ = {type: 'ParamList', required: [], optional: [], splat: $1,   block: $2};"),
    o('f_block_arg',                                   "$$ = {type: 'ParamList', required: [], optional: [], splat: null, block: $1};"),
    o('none',                                          "$$ = {type: 'ParamList', required: [], optional: [], splat: null, block: null};")
  ],

  f_arg: [
    o('tIDENTIFIER',         "$$ = [$1];"),
    o('f_arg , tIDENTIFIER', "$1.push($3);")
  ],

  f_rest_arg: [
    o('* tIDENTIFIER', "$$ = $2"),
    o('*')
  ],

  f_block_arg: [
    o('& tIDENTIFIER', "$$ = $2;")
  ],

  opt_f_block_arg: [
    o(', f_block_arg', "$$ = $2;"),
    o('none',          "$$ = null;")
  ],

  f_opt: [
    o('tIDENTIFIER = arg', "$$ = {name: $1, expression: $3};")
  ],

  f_optarg: [
    o('f_opt',            "$$ = [$1];"),
    o('f_optarg , f_opt', "$1.push($3);")
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

  xstring: [
    o('tXSTRING_BEG xstring_contents tSTRING_END', "$$ = {type: 'XString', value: $2};")
  ],

  xstring_contents: [
    o('none', "$$ = '';"),
    o('xstring_contents string_content', "$$ += $2;")
  ],

  string_content: [
    o('tSTRING_CONTENT')
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

