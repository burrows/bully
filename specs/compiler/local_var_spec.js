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
    var body = compile('foo = 1; bar = 2; foo = 3')[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['putobject', 2],
          ['setlocal', 1],
          ['putobject', 3],
          ['setlocal', 0],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

