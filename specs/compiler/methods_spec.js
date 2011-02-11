var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: method calls', {
  'should add getlocal instruction if there is no expression, no args, and a local variable with the given name is defined': function(t) {
    var body = compile('a = 1; a')[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['getlocal', 0],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should compile a method call if there is a local variable declared with the same name but there are arguments': function(t) {
    var body = compile('a = 1; a(2)')[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['putself'],
          ['putobject', 2],
          ['send', 'a', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should compile the expression if there is one': function(t) {
    var body = compile('a = 1; a.foo')[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['getlocal', 0],
          ['send', 'foo', 0],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should use putself if there is no expression': function(t) {
    var body = compile('foo(2)')[Helper.BodyIdx],
        exp = [
          ['putself'],
          ['putobject', 2],
          ['send', 'foo', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should give the number of arguments to the send instruction': function(t) {
    var body = compile('foo(1,2,3,4,5)')[Helper.BodyIdx],
        exp = [
          ['putself'],
          ['putobject', 1],
          ['putobject', 2],
          ['putobject', 3],
          ['putobject', 4],
          ['putobject', 5],
          ['send', 'foo', 5],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add the pop instruction if result is not used': function(t) {
    var body = compile('foo(); 1')[Helper.BodyIdx],
        exp = [
          ['putself'],
          ['send', 'foo', 0],
          ['pop'],
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should not add the pop instruction if result is used': function(t) {
    var body = compile('x = foo(); 1')[Helper.BodyIdx],
        exp = [
          ['putself'],
          ['send', 'foo', 0],
          ['setlocal', 0],
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should not add the pop instruction if call is last expression in the body': function(t) {
    var body = compile('foo()')[Helper.BodyIdx],
        exp = [
          ['putself'],
          ['send', 'foo', 0],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: non-singleton method definitions with no params', {
  'should use putcurrentmodule': function(t) {
    var body = compile('def foo; end')[Helper.BodyIdx];

    t.assertEqual(['putcurrentmodule'], body[0]);
  },

  'should use add the definemethod instruction with the method name and false to indicate its not a singleton method': function(t) {
    var body = compile('def foo; end')[Helper.BodyIdx];

    t.assertEqual(['definemethod', 'foo', false], body[2]);
  },

  'should add the compiled method body using putiseq': function(t) {
    var body = compile('def foo; end')[Helper.BodyIdx];

    t.assertEqual('putiseq', body[1][0]);
  },

  'should compile the method body into a new iseq of type "method" and the name of the method': function(t) {
    var body = compile('def foo; 1; end')[Helper.BodyIdx],
        iseq = body[1][1],
        methodbody = iseq[Helper.BodyIdx],
        exp = [
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual('BullyInstructionSequence', iseq[0]);
    t.assertEqual('foo', iseq[Helper.NameIdx]);
    t.assertEqual('method', iseq[Helper.TypeIdx]);

    t.assertEqual(exp, methodbody);
  },

  'should add putnil instruction if definition is used in an expression': function(t) {
    var body = compile('x = def foo; end; nil')[Helper.BodyIdx],
        len = body.length;

    t.assertEqual('definemethod',  body[len - 5][0]);
    t.assertEqual(['putnil'],      body[len - 4]);
    t.assertEqual(['setlocal', 0], body[len - 3]);
    t.assertEqual(['putnil'],      body[len - 2]);
    t.assertEqual(['leave'],       body[len - 1]);
  }
});

TestIt('Compiler: non-singleton method definitions with params', {
  'should add param names to locals': function(t) {
    var body = compile('def foo(a, b, c = 1, *d); end')[Helper.BodyIdx],
        iseq = body[1][1];

    t.assertEqual(['a', 'b', 'c', 'd'], iseq[Helper.LocalsIdx]);
  },

  'should set number of required args at index 0 of arguments descriptor': function(t) {
    var args = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[Helper.BodyIdx][1][1][Helper.ArgsIdx];

    t.assertEqual(3, args[0]);
  },

  'should set number of optional args at index 1 of arguments descriptor': function(t) {
    var args = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[Helper.BodyIdx][1][1][Helper.ArgsIdx];

    t.assertEqual(2, args[1]);
  },

  'should set index of splat param at index 2 of arguments descriptor': function(t) {
    var args1 = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[Helper.BodyIdx][1][1][Helper.ArgsIdx],
        args2 = compile('def foo(a,b,c=1); end')[Helper.BodyIdx][1][1][Helper.ArgsIdx];

    t.assertEqual(5, args1[2]);
    t.assertEqual(-1, args2[2]);
  },

  'should add optional argument labels and body start label at index 3 of arguments descriptor': function(t) {
    var args = compile('def foo(a=1,b=2); end')[Helper.BodyIdx][1][1][Helper.ArgsIdx];

    t.assertEqual(['optarg-a-0', 'optarg-b-3', 'bodystart-6'], args[3]);
  },

  'should compile default values for optional arugments at beginning of body with appropriate labels': function(t) {
    var methodbody = compile('def foo(a=1,b=2); a + b; end')[Helper.BodyIdx][1][1][Helper.BodyIdx];
        exp = [
          'optarg-a-0',
          ['putobject', 1],
          ['setlocal', 0],
          'optarg-b-3',
          ['putobject', 2],
          ['setlocal', 1],
          'bodystart-6',
          ['getlocal', 0],
          ['getlocal', 1],
          ['send', '+', 1],
          ['leave']
        ];

    t.assertEqual(exp, methodbody);
  }
});
