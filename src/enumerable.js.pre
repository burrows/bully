
Bully.init_enumerable = function() {
  Bully.Enumerable = Bully.define_module('Enumerable');

  Bully.define_method(Bully.Enumerable, 'select', function(self, args, block) {
    var results = [];

    Bully.dispatch_method(self, 'each', [], function(args) {
      var x = args[0], r;
      if (Bully.test(Bully.Evaluator._yield(block, [x]))) {
        results.push(x);
      }
    });

    return Bully.array_new(results);
  }, 0, 0);
};
