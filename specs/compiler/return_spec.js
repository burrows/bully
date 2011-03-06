var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: return statements outside of a block', {
  'with no expression should insert a putnil instruction followed by a leave instruction': function(t) {
    var body = compile('def foo; return; end')[Helper.BodyIdx],
        methodbody = body[1][2][Helper.BodyIdx],
        exp  = [
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, methodbody);
  },

  'with an expression should compile the expression and then insert a leave instruction': function(t) {
    var body = compile('def foo; return :x; end')[Helper.BodyIdx],
        methodbody = body[1][2][Helper.BodyIdx],
        exp  = [
          ['putsymbol', 'x'],
          ['leave']
        ];

    t.assertEqual(exp, methodbody);
  }
});

TestIt('Compiler: return statements inside of a block', {
  'with no expression should insert a putnil instruction followed by a throw instruction': function(t) {
    var body = compile('def foo; lambda { return }; end')[Helper.BodyIdx],
        methodbody = body[1][2][Helper.BodyIdx],
        procbody = methodbody[2][3][Helper.BodyIdx],
        exp  = [
          'block-begin-0',
          ['putnil'],
          ['throw', 1],
          'block-end-3',
          ['leave']
        ];

    t.assertEqual(exp, procbody);
  },

  'with an expression should compile the expression and then insert a throw instruction': function(t) {
    var body = compile('def foo; lambda { return 2 }; end')[Helper.BodyIdx],
        methodbody = body[1][2][Helper.BodyIdx],
        procbody = methodbody[2][3][Helper.BodyIdx],
        exp  = [
          'block-begin-0',
          ['putobject', 2],
          ['throw', 1],
          'block-end-3',
          ['leave']
        ];

    t.assertEqual(exp, procbody);
  },

  'inside an if should insert a throw instruction': function(t) {
    var body = compile('def foo; lambda { if 1; return 9; end }; end')[Helper.BodyIdx],
        methodbody = body[1][2][Helper.BodyIdx],
        procbody = methodbody[2][3][Helper.BodyIdx],
        exp  = [
          'block-begin-0',
          ['putobject', 1],
          ['branchunless', 'label-6'],
          ['putobject', 9],
          ['throw', 1],
          ['jump', 'label-8'],
          'label-6',
          ['putnil'],
          'label-8',
          'block-end-9',
          ['leave']
        ];

    t.assertEqual(exp, procbody);
  }
});
