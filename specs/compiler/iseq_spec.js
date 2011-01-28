var Helper  = require('./helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: ISeq', {
  'should include "BullyInstructionSequence" at index 0': function(t) {
    t.assertEqual('BullyInstructionSequence', compile('1')[0]);
  },

  'should include the name at index 1': function(t) {
    t.assertEqual('<compiled>', compile('1')[Helper.NameIdx]);
  },

  'should include the type at index 2': function(t) {
    t.assertEqual('top', compile('1')[Helper.TypeIdx]);
  },

  'should include the maximum stack size at index 3': function(t) {
    t.assertEqual(2, compile('1 + 1')[Helper.MaxStackIdx]);
    t.assertEqual(4, compile('foo(1,2,3)')[Helper.MaxStackIdx]);
  },

  'should include an array of local variable names at index 4': function(t) {
    t.assertEqual(['a', 'b', 'c'], compile('a = 1; b = 2; c = 3')[Helper.LocalsIdx]);
  },

  'should include the arguments descriptor array at index 5': function(t) {
    t.assertEqual([0,0,-1,[]], compile('1')[Helper.ArgsIdx]);
  },

  'should include the catch table at index 6': function(t) {
    t.assertEqual([], compile('1')[Helper.CatchIdx]);
  },

  'should include the body at index 7': function(t) {
    var exp = [
      ['putself'],
      ['putobject', 1],
      ['send', 'foo', 1],
      ['leave']
    ];
    t.assertEqual(exp, compile('foo(1)')[Helper.BodyIdx]);
  }
});
