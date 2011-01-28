var Helper  = require('./helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: string literals', {
  'should add no instruction if string literal is not used in an expression': function(t) {
    var body = compile('"foo"; 2')[Helper.BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add putstring instruction if string literal is used in an expression': function(t) {
    var body = compile('p "foo"')[Helper.BodyIdx],
        exp  = [
          ['putself'],
          ['putstring', 'foo'],
          ['send', 'p', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: boolean literals', {
  'should add no instruction if literal is not used in an expression': function(t) {
    var body = compile('true; false; 2')[Helper.BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add putobject instruction if literal is used in an expression': function(t) {
    var body = compile('x = true; y = false')[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['setlocal', 0],
          ['putobject', false],
          ['setlocal', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: number literals', {
  'should add no instruction if literal is not used in an expression': function(t) {
    var body = compile('1; 2')[Helper.BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add putobject instruction if literal is used in an expression': function(t) {
    var body = compile('1.1 + 2.78')[Helper.BodyIdx],
        exp  = [
          ['putobject', 1.1],
          ['putobject', 2.78],
          ['send', '+', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

