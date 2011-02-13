var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: super expressions', {
  'with no args or parens should put false on the stack and insert an invokesuper instruction with an arg count of 0 and nil for the blockiseq': function(t) {
    var body = compile('super; nil')[Helper.BodyIdx],
        exp  = [
          ['putobject', false],
          ['invokesuper', 0, null],
          ['pop'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with 0 args and empty parens should put true on the stack and insert an invokesuper instruction with an arg count of 0 and nil for the blockiseq': function(t) {
    var body = compile('super(); nil')[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['invokesuper', 0, null],
          ['pop'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with args should put true on the stack and compile args and insert an invokesuper instruction with the arg count and nil for the blockiseq': function(t) {
    var body = compile('super 1, 2, 3; nil')[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['putobject', 1],
          ['putobject', 2],
          ['putobject', 3],
          ['invokesuper', 3, null],
          ['pop'],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});
