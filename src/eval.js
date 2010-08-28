Bully.evaluate = function(ast) {
  var ctx = {self: Bully.main};
  (new Bully.Nodes[ast.type](ast)).evaluate(ctx);
};
