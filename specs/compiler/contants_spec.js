var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: constant references', {
  'with global scope operator should add putbuiltin instruction for Object': function(t) {
    var body = compile('::Foo')[Helper.BodyIdx],
        exp  = [
          ['putbuiltin', 'Object'],
          ['getconstant', 'Foo'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'without global scope operator should add putnil instruction to indicate lexical lookup': function(t) {
    var body = compile('Foo')[Helper.BodyIdx],
        exp  = [
          ['putnil'],
          ['getconstant', 'Foo'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'for scoped constants should add getconstant instructions for each name': function(t) {
    var body = compile('Foo::Bar::Baz')[Helper.BodyIdx],
        exp  = [
          ['putnil'],
          ['getconstant', 'Foo'],
          ['getconstant', 'Bar'],
          ['getconstant', 'Baz'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add pop instruction if constant is not used in an expression': function(t) {
    var body = compile('Foo; 1')[Helper.BodyIdx],
        exp  = [
          ['putnil'],
          ['getconstant', 'Foo'],
          ['pop'],
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

