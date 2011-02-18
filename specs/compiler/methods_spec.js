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
          ['send', 'a', 1, null],
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
          ['send', 'foo', 0, null],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should use putself if there is no expression': function(t) {
    var body = compile('foo(2)')[Helper.BodyIdx],
        exp = [
          ['putself'],
          ['putobject', 2],
          ['send', 'foo', 1, null],
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
          ['send', 'foo', 5, null],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add the pop instruction if result is not used': function(t) {
    var body = compile('foo(); 1')[Helper.BodyIdx],
        exp = [
          ['putself'],
          ['send', 'foo', 0, null],
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
          ['send', 'foo', 0, null],
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
          ['send', 'foo', 0, null],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: assignment method calls', {
  'when not used in a larger expression should add a pop instruction after the send instruction': function(t) {
    var body = compile('"hi".foo = 1; nil')[Helper.BodyIdx],
        exp  = [
          ['putstring', "hi"],
          ['putobject', 1],
          ['send', 'foo=', 1, null],
          ['pop'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'when used in a larger expression should add a putnil instruction first and a setn instruction before the send instruction and add a pop instruction after': function(t) {
    var body = compile('"hi".foo = 1')[Helper.BodyIdx],
        exp  = [
          ['putnil'],
          ['putstring', "hi"],
          ['putobject', 1],
          ['setn', 2],
          ['send', 'foo=', 1, null],
          ['pop'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: bracket assignment method calls', {
  'when not used in a larger expression should send the method "[]=" and add a pop instruction': function(t) {
    var body = compile('"hi"[1,2] = 3; nil')[Helper.BodyIdx],
        exp  = [
          ['putstring', "hi"],
          ['putobject', 1],
          ['putobject', 2],
          ['putobject', 3],
          ['send', '[]=', 3, null],
          ['pop'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'when used in a larger expression should add a putnil instruction first and a setn instruction before the send instruction and add a pop instruction after': function(t) {
    var body = compile('"hi"[1,2] = 3')[Helper.BodyIdx],
        exp  = [
          ['putnil'],
          ['putstring', "hi"],
          ['putobject', 1],
          ['putobject', 2],
          ['putobject', 3],
          ['setn', 4],
          ['send', '[]=', 3, null],
          ['pop'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: non-singleton method definitions with no params', {
  'should use putcbase': function(t) {
    var body = compile('def foo; end')[Helper.BodyIdx];

    t.assertEqual(['putcbase'], body[0]);
  },

  'should add the definemethod instruction with the method name and false to indicate its not a singleton method': function(t) {
    var body = compile('def foo; end')[Helper.BodyIdx];

    t.assertEqual('definemethod', body[1][0]);
    t.assertEqual('foo', body[1][1]);
    t.assertEqual(false, body[1][3]);
  },

  'should compile the method body into a new iseq of type "method" and the name of the method and insert as the second param to definemethod': function(t) {
    var body = compile('def foo; 1; end')[Helper.BodyIdx],
        miseq = body[1][2],
        mbody = miseq[Helper.BodyIdx],
        exp = [
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual('BullyInstructionSequence', miseq[0]);
    t.assertEqual('foo', miseq[Helper.NameIdx]);
    t.assertEqual('method', miseq[Helper.TypeIdx]);
    t.assertEqual(exp, mbody);
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
        iseq = body[1][2];

    t.assertEqual(['a', 'b', 'c', 'd'], iseq[Helper.LocalsIdx]);
  },

  'should set number of required args at index 0 of arguments descriptor': function(t) {
    var args = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[Helper.BodyIdx][1][2][Helper.ArgsIdx];

    t.assertEqual(3, args[0]);
  },

  'should set number of optional args at index 1 of arguments descriptor': function(t) {
    var args = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[Helper.BodyIdx][1][2][Helper.ArgsIdx];

    t.assertEqual(2, args[1]);
  },

  'should set index of splat param at index 2 of arguments descriptor': function(t) {
    var args1 = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[Helper.BodyIdx][1][2][Helper.ArgsIdx],
        args2 = compile('def foo(a,b,c=1); end')[Helper.BodyIdx][1][2][Helper.ArgsIdx];

    t.assertEqual(5, args1[2]);
    t.assertEqual(-1, args2[2]);
  },

  'should add optional argument labels and body start label at index 3 of arguments descriptor': function(t) {
    var args = compile('def foo(a=1,b=2); end')[Helper.BodyIdx][1][2][Helper.ArgsIdx];

    t.assertEqual(['optarg-a-0', 'optarg-b-3', 'bodystart-6'], args[3]);
  },

  'should compile default values for optional arugments at beginning of body with appropriate labels': function(t) {
    var methodbody = compile('def foo(a=1,b=2); a + b; end')[Helper.BodyIdx][1][2][Helper.BodyIdx];
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
          ['send', '+', 1, null],
          ['leave']
        ];

    t.assertEqual(exp, methodbody);
  }
});

TestIt('Compiler: singleton method definitions with no params', {
  'should use compile the object to define the method on': function(t) {
    var body = compile('def self.foo; end')[Helper.BodyIdx];

    t.assertEqual(['putself'], body[0]);
  },

  'should add the definemethod instruction with the method name and true to indicate it is a singleton method': function(t) {
    var body = compile('def self.foo; end')[Helper.BodyIdx];

    t.assertEqual('definemethod', body[1][0]);
    t.assertEqual('foo', body[1][1]);
    t.assertEqual(true, body[1][3]);
  },

  'should compile the method body into a new iseq of type "method" and the name of the method and insert as the second param to definemethod': function(t) {
    var body = compile('def self.foo; 1; end')[Helper.BodyIdx],
        miseq = body[1][2],
        mbody = miseq[Helper.BodyIdx],
        exp = [
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual('BullyInstructionSequence', miseq[0]);
    t.assertEqual('foo', miseq[Helper.NameIdx]);
    t.assertEqual('method', miseq[Helper.TypeIdx]);
    t.assertEqual(exp, mbody);
  },

  'should add putnil instruction if definition is used in an expression': function(t) {
    var body = compile('x = def self.foo; end; nil')[Helper.BodyIdx],
        len = body.length;

    t.assertEqual('definemethod',  body[len - 5][0]);
    t.assertEqual(['putnil'],      body[len - 4]);
    t.assertEqual(['setlocal', 0], body[len - 3]);
    t.assertEqual(['putnil'],      body[len - 2]);
    t.assertEqual(['leave'],       body[len - 1]);
  }
});

