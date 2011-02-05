var Helper  = require('./helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: local variable assignments', {
  "should add an entry to the iseq's locals table": function(t) {
    var iseq = compile('foo = 1; bar = 2');

    t.assertEqual(['foo', 'bar'], iseq[Helper.LocalsIdx]);
  },

  'should add setlocal instruction with the correct index': function(t) {
    var body = compile('foo = 1; bar = 2; foo = 3; nil')[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['putobject', 2],
          ['setlocal', 1],
          ['putobject', 3],
          ['setlocal', 0],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add a dup instruction if assignment is used in an expression': function(t) {
    var body = compile('p(foo = 1)')[Helper.BodyIdx],
        exp  = [
          ['putself'],
          ['putobject', 1],
          ['dup'],
          ['setlocal', 0],
          ['send', 'p', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

