/* Jison generated parser */
Bully.parser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"program":3,"compstmt":4,"bodystmt":5,"stmts":6,"opt_terms":7,"none":8,"stmt":9,"terms":10,"expr":11,"arg":12,"expr_value":13,"+":14,"primary":15,"arg_value":16,"literal":17,"method_call":18,"primary_value":19,"tNUMBER":20,"operation":21,"paren_args":22,".":23,"operation2":24,"(":25,")":26,"call_args":27,"opt_nl":28,"opt_paren_args":29,"args":30,"opt_block_arg":31,"block_arg":32,"tAMPER":33,",":34,"tIDENTIFIER":35,"tCONSTANT":36,"tFID":37,"op":38,"|":39,"^":40,"&":41,"tCMP":42,"tEQ":43,"tEQQ":44,"tMATCH":45,">":46,"tGEQ":47,"<":48,"tLEQ":49,"tLSHFT":50,"tRSHFT":51,"-":52,"*":53,"tSTAR":54,"/":55,"%":56,"tPOW":57,"~":58,"tUPLUS":59,"tUMINUS":60,"tAREF":61,"tASET":62,"`":63,"term":64,";":65,"tNEWLINE":66,"$accept":0,"$end":1},
terminals_: {2:"error",14:"+",20:"tNUMBER",23:".",25:"(",26:")",33:"tAMPER",34:",",35:"tIDENTIFIER",36:"tCONSTANT",37:"tFID",39:"|",40:"^",41:"&",42:"tCMP",43:"tEQ",44:"tEQQ",45:"tMATCH",46:">",47:"tGEQ",48:"<",49:"tLEQ",50:"tLSHFT",51:"tRSHFT",52:"-",53:"*",54:"tSTAR",55:"/",56:"%",57:"tPOW",58:"~",59:"tUPLUS",60:"tUMINUS",61:"tAREF",62:"tASET",63:"`",65:";",66:"tNEWLINE"},
productions_: [0,[3,1],[5,1],[4,2],[6,1],[6,1],[6,3],[9,1],[11,1],[13,1],[12,3],[12,1],[16,1],[15,1],[15,1],[19,1],[17,1],[18,2],[18,3],[22,3],[22,4],[29,1],[29,1],[27,2],[32,2],[31,2],[31,1],[30,1],[30,3],[21,1],[21,1],[21,1],[24,1],[24,1],[24,1],[24,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[64,1],[64,1],[10,1],[10,2],[7,1],[7,1],[28,1],[28,1],[8,0]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:this.$ = {type: 'Program', statements: $$[$0]}; return this.$;
break;
case 2:this.$ = $$[$0];
break;
case 3:this.$ = $$[$0-1];
break;
case 4:this.$ = [];
break;
case 5:this.$ = [$$[$0]];
break;
case 6:$$[$0-2].push($$[$0]);
break;
case 7:this.$ = $$[$0];
break;
case 8:this.$ = $$[$0];
break;
case 9:this.$ = $$[$0];
break;
case 10:this.$ = {type: 'OperatorCall', left: $$[$0-2], right: $$[$0], op: $$[$0-1]};
break;
case 11:this.$ = $$[$0];
break;
case 12:this.$ = $$[$0];
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = $$[$0];
break;
case 15:this.$ = $$[$0];
break;
case 16:this.$ = {type: 'NumberLiteral', value: $$[$0]};
break;
case 17:this.$ = {type: 'FunctionCall', name: $$[$0-1], args: $$[$0]};
break;
case 18:this.$ = {type: 'MethodCall', receiver: $$[$0-2], name: $$[$0]};
break;
case 19:this.$ = [];
break;
case 20:this.$ = $$[$0-2];
break;
case 21:this.$ = $$[$0];
break;
case 22:this.$ = $$[$0];
break;
case 23:this.$ = {type: 'CallArgs', args: $$[$0-1], block_arg: $$[$0]};
break;
case 24:this.$ = $$[$0-1];
break;
case 25:this.$ = $$[$0-1];
break;
case 26:this.$ = null;
break;
case 27:this.$ = [$$[$0]];
break;
case 28:$$[$0-2].push($$[$0]);
break;
case 29:this.$ = $$[$0];
break;
case 30:this.$ = $$[$0];
break;
case 31:this.$ = $$[$0];
break;
case 32:this.$ = $$[$0];
break;
case 33:this.$ = $$[$0];
break;
case 34:this.$ = $$[$0];
break;
case 35:this.$ = $$[$0];
break;
case 36:this.$ = $$[$0];
break;
case 37:this.$ = $$[$0];
break;
case 38:this.$ = $$[$0];
break;
case 39:this.$ = $$[$0];
break;
case 40:this.$ = $$[$0];
break;
case 41:this.$ = $$[$0];
break;
case 42:this.$ = $$[$0];
break;
case 43:this.$ = $$[$0];
break;
case 44:this.$ = $$[$0];
break;
case 45:this.$ = $$[$0];
break;
case 46:this.$ = $$[$0];
break;
case 47:this.$ = $$[$0];
break;
case 48:this.$ = $$[$0];
break;
case 49:this.$ = $$[$0];
break;
case 50:this.$ = $$[$0];
break;
case 51:this.$ = $$[$0];
break;
case 52:this.$ = $$[$0];
break;
case 53:this.$ = $$[$0];
break;
case 54:this.$ = $$[$0];
break;
case 55:this.$ = $$[$0];
break;
case 56:this.$ = $$[$0];
break;
case 57:this.$ = $$[$0];
break;
case 58:this.$ = $$[$0];
break;
case 59:this.$ = $$[$0];
break;
case 60:this.$ = $$[$0];
break;
case 61:this.$ = $$[$0];
break;
case 62:this.$ = $$[$0];
break;
case 63:this.$ = $$[$0];
break;
case 64:this.$ = $$[$0];
break;
case 65:this.$ = $$[$0-1];
break;
case 66:this.$ = $$[$0];
break;
case 67:this.$ = $$[$0];
break;
case 68:this.$ = $$[$0];
break;
case 69:this.$ = $$[$0];
break;
case 70:this.$ = $$[$0];
break;
}
},
table: [{1:[2,70],3:1,4:2,6:3,8:4,9:5,11:6,12:7,15:8,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15],65:[2,70],66:[2,70]},{1:[3]},{1:[2,1]},{1:[2,70],7:16,8:18,10:17,64:19,65:[1,20],66:[1,21]},{1:[2,4],65:[2,4],66:[2,4]},{1:[2,5],65:[2,5],66:[2,5]},{1:[2,7],65:[2,7],66:[2,7]},{1:[2,8],14:[1,22],65:[2,8],66:[2,8]},{1:[2,11],14:[2,11],23:[1,23],26:[2,11],34:[2,11],65:[2,11],66:[2,11]},{1:[2,13],14:[2,13],23:[2,13],26:[2,13],34:[2,13],65:[2,13],66:[2,13]},{1:[2,14],14:[2,14],23:[2,14],26:[2,14],34:[2,14],65:[2,14],66:[2,14]},{1:[2,16],14:[2,16],23:[2,16],26:[2,16],34:[2,16],65:[2,16],66:[2,16]},{22:24,25:[1,25]},{25:[2,29]},{25:[2,30]},{25:[2,31]},{1:[2,3]},{1:[2,67],9:26,11:6,12:7,15:8,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15],64:27,65:[1,20],66:[1,21]},{1:[2,66]},{1:[2,64],20:[2,64],35:[2,64],36:[2,64],37:[2,64],65:[2,64],66:[2,64]},{1:[2,62],20:[2,62],35:[2,62],36:[2,62],37:[2,62],65:[2,62],66:[2,62]},{1:[2,63],20:[2,63],35:[2,63],36:[2,63],37:[2,63],65:[2,63],66:[2,63]},{12:28,15:8,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15]},{14:[1,47],24:29,35:[1,30],36:[1,31],37:[1,32],38:33,39:[1,34],40:[1,35],41:[1,36],42:[1,37],43:[1,38],44:[1,39],45:[1,40],46:[1,41],47:[1,42],48:[1,43],49:[1,44],50:[1,45],51:[1,46],52:[1,48],53:[1,49],54:[1,50],55:[1,51],56:[1,52],57:[1,53],58:[1,54],59:[1,55],60:[1,56],61:[1,57],62:[1,58],63:[1,59]},{1:[2,17],14:[2,17],23:[2,17],26:[2,17],34:[2,17],65:[2,17],66:[2,17]},{8:60,12:64,15:8,16:63,17:9,18:10,20:[1,11],21:12,26:[2,70],27:61,30:62,35:[1,13],36:[1,14],37:[1,15]},{1:[2,6],65:[2,6],66:[2,6]},{1:[2,65],20:[2,65],35:[2,65],36:[2,65],37:[2,65],65:[2,65],66:[2,65]},{1:[2,10],14:[2,10],26:[2,10],34:[2,10],65:[2,10],66:[2,10]},{1:[2,18],14:[2,18],23:[2,18],26:[2,18],34:[2,18],65:[2,18],66:[2,18]},{1:[2,32],14:[2,32],23:[2,32],26:[2,32],34:[2,32],65:[2,32],66:[2,32]},{1:[2,33],14:[2,33],23:[2,33],26:[2,33],34:[2,33],65:[2,33],66:[2,33]},{1:[2,34],14:[2,34],23:[2,34],26:[2,34],34:[2,34],65:[2,34],66:[2,34]},{1:[2,35],14:[2,35],23:[2,35],26:[2,35],34:[2,35],65:[2,35],66:[2,35]},{1:[2,36],14:[2,36],23:[2,36],26:[2,36],34:[2,36],65:[2,36],66:[2,36]},{1:[2,37],14:[2,37],23:[2,37],26:[2,37],34:[2,37],65:[2,37],66:[2,37]},{1:[2,38],14:[2,38],23:[2,38],26:[2,38],34:[2,38],65:[2,38],66:[2,38]},{1:[2,39],14:[2,39],23:[2,39],26:[2,39],34:[2,39],65:[2,39],66:[2,39]},{1:[2,40],14:[2,40],23:[2,40],26:[2,40],34:[2,40],65:[2,40],66:[2,40]},{1:[2,41],14:[2,41],23:[2,41],26:[2,41],34:[2,41],65:[2,41],66:[2,41]},{1:[2,42],14:[2,42],23:[2,42],26:[2,42],34:[2,42],65:[2,42],66:[2,42]},{1:[2,43],14:[2,43],23:[2,43],26:[2,43],34:[2,43],65:[2,43],66:[2,43]},{1:[2,44],14:[2,44],23:[2,44],26:[2,44],34:[2,44],65:[2,44],66:[2,44]},{1:[2,45],14:[2,45],23:[2,45],26:[2,45],34:[2,45],65:[2,45],66:[2,45]},{1:[2,46],14:[2,46],23:[2,46],26:[2,46],34:[2,46],65:[2,46],66:[2,46]},{1:[2,47],14:[2,47],23:[2,47],26:[2,47],34:[2,47],65:[2,47],66:[2,47]},{1:[2,48],14:[2,48],23:[2,48],26:[2,48],34:[2,48],65:[2,48],66:[2,48]},{1:[2,49],14:[2,49],23:[2,49],26:[2,49],34:[2,49],65:[2,49],66:[2,49]},{1:[2,50],14:[2,50],23:[2,50],26:[2,50],34:[2,50],65:[2,50],66:[2,50]},{1:[2,51],14:[2,51],23:[2,51],26:[2,51],34:[2,51],65:[2,51],66:[2,51]},{1:[2,52],14:[2,52],23:[2,52],26:[2,52],34:[2,52],65:[2,52],66:[2,52]},{1:[2,53],14:[2,53],23:[2,53],26:[2,53],34:[2,53],65:[2,53],66:[2,53]},{1:[2,54],14:[2,54],23:[2,54],26:[2,54],34:[2,54],65:[2,54],66:[2,54]},{1:[2,55],14:[2,55],23:[2,55],26:[2,55],34:[2,55],65:[2,55],66:[2,55]},{1:[2,56],14:[2,56],23:[2,56],26:[2,56],34:[2,56],65:[2,56],66:[2,56]},{1:[2,57],14:[2,57],23:[2,57],26:[2,57],34:[2,57],65:[2,57],66:[2,57]},{1:[2,58],14:[2,58],23:[2,58],26:[2,58],34:[2,58],65:[2,58],66:[2,58]},{1:[2,59],14:[2,59],23:[2,59],26:[2,59],34:[2,59],65:[2,59],66:[2,59]},{1:[2,60],14:[2,60],23:[2,60],26:[2,60],34:[2,60],65:[2,60],66:[2,60]},{1:[2,61],14:[2,61],23:[2,61],26:[2,61],34:[2,61],65:[2,61],66:[2,61]},{26:[1,65]},{8:67,26:[2,70],28:66,66:[1,68]},{8:71,26:[2,70],31:69,34:[1,70],66:[2,70]},{26:[2,27],34:[2,27],66:[2,27]},{14:[1,22],26:[2,12],34:[2,12],66:[2,12]},{1:[2,19],14:[2,19],23:[2,19],26:[2,19],34:[2,19],65:[2,19],66:[2,19]},{26:[1,72]},{26:[2,68]},{26:[2,69]},{26:[2,23],66:[2,23]},{12:64,15:8,16:73,17:9,18:10,20:[1,11],21:12,32:74,33:[1,75],35:[1,13],36:[1,14],37:[1,15]},{26:[2,26],66:[2,26]},{1:[2,20],14:[2,20],23:[2,20],26:[2,20],34:[2,20],65:[2,20],66:[2,20]},{26:[2,28],34:[2,28],66:[2,28]},{26:[2,25],66:[2,25]},{12:64,15:8,16:76,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15]},{26:[2,24],66:[2,24]}],
defaultActions: {2:[2,1],13:[2,29],14:[2,30],15:[2,31],16:[2,3],18:[2,66],67:[2,68],68:[2,69]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = "",
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = "";
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = Bully.parser;
exports.parse = function () { return Bully.parser.parse.apply(Bully.parser, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require('fs').readFileSync(require('path').join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}