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
          ['send', 'p', 1, null],
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
          ['dup'],
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
          ['send', '+', 1, null],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: symbol literals', {
  'should add no instruction if symbol is not used in an expression': function(t) {
    var body = compile(':foo; 2')[Helper.BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add putsymbol instruction if used in an expression': function(t) {
    var body = compile(':foo')[Helper.BodyIdx],
        exp  = [
          ['putsymbol', 'foo'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },
});

TestIt('Compiler: array literals', {
  'should add no instruction if array is not used in an expression': function(t) {
    var body = compile('[1,2,3]; 2')[Helper.BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should compile each item and then add a newarray instruction if used in an expression': function(t) {
    var body = compile('p [1,:two,"three"]')[Helper.BodyIdx],
        exp  = [
          ['putself'],
          ['putobject', 1],
          ['putsymbol', 'two'],
          ['putstring', 'three'],
          ['newarray', 3],
          ['send', 'p', 1, null],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});
