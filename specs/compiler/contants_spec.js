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

TestIt('Compiler: bare constant assignment not used in a larger expression', {
  'should compile assigned value and then insert putcbase and setconstant instructions': function(t) {
    var body = compile('Foo = :hello; nil')[Helper.BodyIdx],
        exp  = [
          ['putsymbol', 'hello'],
          ['putcbase'],
          ['setconstant', 'Foo'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: bare constant assignment used in a larger expression', {
  'should compile assigned value and then insert dup, putcbase and setconstant instructions': function(t) {
    var body = compile('Foo = :hello')[Helper.BodyIdx],
        exp  = [
          ['putsymbol', 'hello'],
          ['dup'],
          ['putcbase'],
          ['setconstant', 'Foo'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: scoped constant assignment not used in a larger expression', {
  'should compile the outer constant references and add a setconstant instruction with the last constant name': function(t) {
    var body = compile('Foo::Bar::Baz = :hello; nil')[Helper.BodyIdx],
        exp  = [
          ['putsymbol', 'hello'],
          ['putnil'],
          ['getconstant', 'Foo'],
          ['getconstant', 'Bar'],
          ['setconstant', 'Baz'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: global scoped constant assignment not used in a larger expression', {
  'should set the constant on Object using a putbuiltin instruction': function(t) {
    var body = compile('::Foo = :hello; nil')[Helper.BodyIdx],
        exp  = [
          ['putsymbol', 'hello'],
          ['putbuiltin', 'Object'],
          ['setconstant', 'Foo'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

