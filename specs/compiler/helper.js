exports.Helper = {
  TestIt      : require(__dirname + '/../../vendor/test_it/src/test_it').TestIt,
  Bully       : require(__dirname + '/../../src/bully').Bully,
  NameIdx     : 1,
  TypeIdx     : 2,
  MaxStackIdx : 3,
  LocalsIdx   : 4,
  ArgsIdx     : 5,
  CatchIdx    : 6,
  BodyIdx     : 7,
  compile     : function(src) {
    var ast = Bully.parser.parse((new Bully.Lexer()).tokenize(src));
    return Bully.Compiler.compile(ast);
  }
};
