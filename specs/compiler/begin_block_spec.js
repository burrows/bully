var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: begin blocks with no rescues, ensures, or else', {
  'before all': function(t) {
    this.iseq = compile("begin\n3 * 2\nend");
    this.body = this.iseq[Helper.BodyIdx];
    this.catchTable = this.iseq[Helper.CatchIdx];
  },

  'should simply compile the body': function(t) {
    var body = compile("begin\n3 * 2\nend")[Helper.BodyIdx],
        exp  = [
          ['putobject', 3],
          ['putobject', 2],
          ['send', '*', 1, null],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should have an empty catch table': function(t) {
    t.assertEqual(0, this.catchTable.length);
  }
});

TestIt('Compiler: begin blocks with only rescue clause with unused value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         end; 1");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.rescueEntry = this.catchTable[0];
    this.retryEntry  = this.catchTable[1];
    this.rescueISeq  = this.rescueEntry[1];
    this.rescueBody  = this.rescueISeq[Helper.BodyIdx];
  },

  'should compile body and pop resulting value': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      'rcont-5',
      ['pop'],
      ['putobject', 1],
      ['leave'],
    ];

    t.assertEqual(exp, this.body);
  },

  'should insert a rescue catch entry': function(t) {
    t.assertEqual('rescue', this.rescueEntry[0]);
  },
  
  'rescue catch entry should have start, end, and continue labels set': function(t) {
    t.assertEqual('rstart-0', this.rescueEntry[2]);
    t.assertEqual('rstop-4', this.rescueEntry[3]);
    t.assertEqual('rcont-5', this.rescueEntry[4]);
  },
  
  'rescue catch entry should have stack pointer set to 0': function(t) {
    t.assertEqual(0, this.rescueEntry[5]);
  },
  
  "rescue catch entry's iseq should have type 'rescue' and name 'rescue in <compiled>'": function(t) {
    t.assertEqual('rescue', this.rescueISeq[Helper.TypeIdx]);
    t.assertEqual('rescue in <compiled>', this.rescueISeq[Helper.NameIdx]);
  },
  
  "rescue catch entry's iseq should have a local variable called '#$!' at index 0": function(t) {
    t.assertEqual(['#$!'], this.rescueISeq[Helper.LocalsIdx]);
  },
  
  "rescue catch entry's iseq body should contain check for StandardError": function(t) {
    var exp = [
      ['putbuiltin', 'StandardError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-5'],
      ['jump', 'next-10'],
      'start-5',
      ['putself'],
      ['putstring', 'rescue'],
      ['send', 'p', 1, null],
      ['leave'],
      'next-10',
      ['getdynamic', 0, 0],
      ['throw', 0]
    ];
  
    t.assertEqual(exp, this.rescueBody);
  },

  'should insert a retry catch entry with type': function(t) {
    t.assertEqual('retry', this.retryEntry[0]);
  },

  "retry catch entry's iseq should be null": function(t) {
    t.assertEqual(null, this.retryEntry[1]);
  },

  'retry catch entry should have start, end, and continue labels set': function(t) {
    t.assertEqual('rstop-4', this.retryEntry[2]);
    t.assertEqual('rcont-5', this.retryEntry[3]);
    t.assertEqual('rstart-0', this.retryEntry[4]);
  }
});

TestIt('Compiler: begin blocks with only rescue clause with used value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         end");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile body and leave resulting value on stack': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      'rcont-5',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with only else clause and unused value', {
  'before all': function(t) {
    this.iseq = compile("begin       \n\
                           p('hi')   \n\
                         else        \n\
                           p('else') \n\
                         end; 1");

    this.body       = this.iseq[Helper.BodyIdx];
    this.catchTable = this.iseq[Helper.CatchIdx];
  },

  'should compile else body into body and pop resulting value': function(t) {
    var exp = [
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      ['pop'],
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  },

  'should have an empty catch table': function(t) {
    t.assertEqual(0, this.catchTable.length);
  }
});

TestIt('Compiler: begin blocks with only else clause and used value', {
  'before all': function(t) {
    this.iseq = compile("begin       \n\
                           p('hi')   \n\
                         else        \n\
                           p('else') \n\
                         end");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile else body into body and leave result on the stack': function(t) {
    var exp = [
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with only ensure clause and unused value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         ensure        \n\
                           p('ensure') \n\
                         end; 1");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.ensureEntry = this.catchTable[0];
    this.ensureISeq  = this.ensureEntry[1];
    this.ensureBody  = this.ensureISeq[Helper.BodyIdx];
  },

  'should compile ensure body into body with start, stop, continue labels and pop resulting value': function(t) {
    var exp = [
      'estart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      ['pop'],
      'estop-5',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-10',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  },

  'should insert an ensure catch entry': function(t) {
    t.assertEqual('ensure', this.ensureEntry[0]);
  },

  'ensure catch entry should have start, end, and continue labels set': function(t) {
    t.assertEqual('estart-0', this.ensureEntry[2]);
    t.assertEqual('estop-5', this.ensureEntry[3]);
    t.assertEqual('econt-10', this.ensureEntry[4]);
  },

  'ensure catch entry should have stack pointer set to 0': function(t) {
    t.assertEqual(0, this.ensureEntry[5]);
  },

  "ensure catch entry's iseq should have type 'ensure' and name 'ensure in <compiled>'": function(t) {
    t.assertEqual('ensure', this.ensureISeq[Helper.TypeIdx]);
    t.assertEqual('ensure in <compiled>', this.ensureISeq[Helper.NameIdx]);
  },

  "ensure catch entry's iseq should have a local variable called '#$!' at index 0": function(t) {
    t.assertEqual(['#$!'], this.ensureISeq[Helper.LocalsIdx]);
  },
  
  "ensure catch entry's iseq body should have compiled ensure body": function(t) {
    var exp = [
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      ['getdynamic', 0, 0],
      ['throw', 0]
    ];
  
    t.assertEqual(exp, this.ensureBody);
  }
});

TestIt('Compiler: begin blocks with only ensure clause and used value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         ensure        \n\
                           p('ensure') \n\
                         end");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure body into body with start, stop, continue labels and leave result value on the stack': function(t) {
    var exp = [
      'estart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'estop-4',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-9',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with rescue and else clause and unused value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         else          \n\
                           p('else')   \n\
                         end; 1");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile else body into body with start, stop, continue rescue labels and pop resulting value': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      'rcont-9',
      ['pop'],
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with rescue and else clause and used value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         else          \n\
                           p('else')   \n\
                         end");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile else body into body with start, stop, continue rescue labels and leave value on stack': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      'rcont-9',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with rescue and ensure clause and unused value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         ensure        \n\
                           p('ensure') \n\
                         end; 1");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.rescueEntry = this.catchTable[0];
    this.rescueISeq  = this.rescueEntry[1];
    this.rescueBody  = this.rescueISeq[Helper.BodyIdx];
    this.retryEntry  = this.catchTable[1];
    this.ensureEntry = this.catchTable[2];
    this.ensureISeq  = this.ensureEntry[1];
    this.ensureBody  = this.ensureISeq[Helper.BodyIdx];
  },

  'should compile ensure body into body with start, stop, continue rescue and ensure labels and pop resulting value': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      'rcont-5',
      ['pop'],
      'estop-7',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-12',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  },

  'should have a rescue catch entry': function(t) {
    t.assertEqual('rescue', this.rescueEntry[0]);
    t.assertEqual('rstart-0', this.rescueEntry[2]);
    t.assertEqual('rstop-4', this.rescueEntry[3]);
    t.assertEqual('rcont-5', this.rescueEntry[4]);
  },

  'should have a retry catch entry': function(t) {
    t.assertEqual('retry', this.retryEntry[0]);
    t.assertEqual(null, this.retryEntry[1]);
    t.assertEqual('rstop-4', this.retryEntry[2]);
    t.assertEqual('rcont-5', this.retryEntry[3]);
    t.assertEqual('rstart-0', this.retryEntry[4]);
  },

  'should have an ensure catch entry': function(t) {
    t.assertEqual('ensure', this.ensureEntry[0]);
    t.assertEqual('rstart-0', this.ensureEntry[2]);
    t.assertEqual('estop-7', this.ensureEntry[3]);
    t.assertEqual('econt-12', this.ensureEntry[4]);
  }
});

TestIt('Compiler: begin blocks with rescue and ensure clause and used value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         ensure        \n\
                           p('ensure') \n\
                         end");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure body into body with start, stop, continue rescue and ensure labels and leave value on the stack': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      'rcont-5',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-10',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with rescue, else, and ensure clauses and unused value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         else          \n\
                           p('else')   \n\
                         ensure        \n\
                           p('ensure') \n\
                         end; 1");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.rescueEntry = this.catchTable[0];
    this.rescueISeq  = this.rescueEntry[1];
    this.rescueBody  = this.rescueISeq[Helper.BodyIdx];
    this.retryEntry  = this.catchTable[1];
    this.ensureEntry = this.catchTable[2];
    this.ensureISeq  = this.ensureEntry[1];
    this.ensureBody  = this.ensureISeq[Helper.BodyIdx];
  },

  'should compile ensure and else bodies into body with start, stop, continue rescue and ensure labels and pop resulting value': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      'rcont-9',
      ['pop'],
      'estop-11',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-16',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  },

  'should have a rescue catch entry': function(t) {
    t.assertEqual('rescue', this.rescueEntry[0]);
    t.assertEqual('rstart-0', this.rescueEntry[2]);
    t.assertEqual('rstop-4', this.rescueEntry[3]);
    t.assertEqual('rcont-9', this.rescueEntry[4]);
  },

  'should have a retry catch entry': function(t) {
    t.assertEqual('retry', this.retryEntry[0]);
    t.assertEqual(null, this.retryEntry[1]);
    t.assertEqual('rstop-4', this.retryEntry[2]);
    t.assertEqual('rcont-9', this.retryEntry[3]);
    t.assertEqual('rstart-0', this.retryEntry[4]);
  },

  'should have an ensure catch entry': function(t) {
    t.assertEqual('ensure', this.ensureEntry[0]);
    t.assertEqual('rstart-0', this.ensureEntry[2]);
    t.assertEqual('estop-11', this.ensureEntry[3]);
    t.assertEqual('econt-16', this.ensureEntry[4]);
  }
});

TestIt('Compiler: begin blocks with rescue, else, and ensure clauses and used value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         else          \n\
                           p('else')   \n\
                         ensure        \n\
                           p('ensure') \n\
                         end");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure and else bodies into body with start, stop, continue rescue and ensure labels and leave value on the stack': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      'rcont-9',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-14',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with else and ensure clauses and unused value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         else          \n\
                           p('else')   \n\
                         ensure        \n\
                           p('ensure') \n\
                         end; 1");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.ensureEntry = this.catchTable[0];
    this.ensureISeq  = this.ensureEntry[1];
    this.ensureBody  = this.ensureISeq[Helper.BodyIdx];
  },

  'should compile ensure and else bodies into body with start, stop, continue ensure labels and pop resulting value': function(t) {
    var exp = [
      'estart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      ['pop'],
      'estop-9',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-14',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  },

  'should have an ensure catch entry': function(t) {
    t.assertEqual('ensure', this.ensureEntry[0]);
    t.assertEqual('estart-0', this.ensureEntry[2]);
    t.assertEqual('estop-9', this.ensureEntry[3]);
    t.assertEqual('econt-14', this.ensureEntry[4]);
  }
});

TestIt('Compiler: begin blocks with else and ensure clauses and used value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         else          \n\
                           p('else')   \n\
                         ensure        \n\
                           p('ensure') \n\
                         end");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure and else bodies into body with start, stop, continue ensure labels and leave value on the stack': function(t) {
    var exp = [
      'estart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1, null],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1, null],
      'estop-8',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1, null],
      ['pop'],
      'econt-13',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with rescue with variable name', {
  'before all': function(t) {
    this.iseq = compile("begin                \n\
                           p('hi')            \n\
                         rescue FooError => e \n\
                           p e                \n\
                         end");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.rescueEntry = this.catchTable[0];
    this.rescueISeq  = this.rescueEntry[1];
    this.rescueBody  = this.rescueISeq[Helper.BodyIdx];
  },

  'local variable should be defined in the parent iseq': function(t) {
    t.assertEqual(['e'], this.iseq[Helper.LocalsIdx]);
    t.assertEqual(['#$!'], this.rescueISeq[Helper.LocalsIdx]);
  },

  'rescue catch entry iseq should assign exception object to local variable': function(t) {
    var exp = [
      ['putnil'],
      ['getconstant', 'FooError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-6'],
      ['jump', 'next-13'],
      'start-6',
      ['getdynamic', 0, 0],
      ['setlocal', 0],
      ['putself'],
      ['getlocal', 0],
      ['send', 'p', 1, null],
      ['leave'],
      'next-13',
      ['getdynamic', 0, 0],
      ['throw', 0]
    ];

    t.assertEqual(exp, this.rescueBody);
  }
});

TestIt('Compiler: begin blocks with multiple types in one rescue block', {
  'before all': function(t) {
    this.iseq = compile("begin                               \n\
                           p('hi')                           \n\
                         rescue FooError, BarError, BazError \n\
                           p('rescue')                       \n\
                         end");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.rescueEntry = this.catchTable[0];
    this.rescueISeq  = this.rescueEntry[1];
    this.rescueBody  = this.rescueISeq[Helper.BodyIdx];
  },

  'rescue catch entry iseq should have checks for each type': function(t) {
    var exp = [
      ['putnil'],
      ['getconstant', 'FooError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-16'],
      ['putnil'],
      ['getconstant', 'BarError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-16'],
      ['putnil'],
      ['getconstant', 'BazError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-16'],
      ['jump', 'next-21'],
      'start-16',
      ['putself'],
      ['putstring', 'rescue'],
      ['send', 'p', 1, null],
      ['leave'],
      'next-21',
      ['getdynamic', 0, 0],
      ['throw', 0]
    ];

    t.assertEqual(exp, this.rescueBody);
  }
});

TestIt('Compiler: begin blocks with multiple rescue blocks', {
  'before all': function(t) {
    this.iseq = compile("begin                            \n\
                           p('hi')                        \n\
                         rescue FooError, BarError => e1  \n\
                           p e1                           \n\
                         rescue BazError, QuuxError => e2 \n\
                           p e2                           \n\
                         end");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.rescueEntry = this.catchTable[0];
    this.rescueISeq  = this.rescueEntry[1];
    this.rescueBody  = this.rescueISeq[Helper.BodyIdx];
  },

  'rescue catch entry iseq should have checks for each block and type': function(t) {
    var exp = [
      ['putnil'],
      ['getconstant', 'FooError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-11'],
      ['putnil'],
      ['getconstant', 'BarError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-11'],
      ['jump', 'next-18'],
      'start-11',
      ['getdynamic', 0, 0],
      ['setlocal', 0],
      ['putself'],
      ['getlocal', 0],
      ['send', 'p', 1, null],
      ['leave'],
      'next-18',
      ['putnil'],
      ['getconstant', 'BazError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-30'],
      ['putnil'],
      ['getconstant', 'QuuxError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-30'],
      ['jump', 'next-37'],
      'start-30',
      ['getdynamic', 0, 0],
      ['setlocal', 1],
      ['putself'],
      ['getlocal', 1],
      ['send', 'p', 1, null],
      ['leave'],
      'next-37',
      ['getdynamic', 0, 0],
      ['throw', 0]
    ];

    t.assertEqual(exp, this.rescueBody);
  }
});

TestIt('Compiler: begin blocks that appear in an expression', {
  'before all': function(t) {
    this.iseq = compile("foo(1, 2, begin     \n\
                                     p('hi')  \n\
                                   rescue     \n\
                                     p('bye') \n\
                                   end)");
    this.body = this.iseq[Helper.BodyIdx];
    this.rescueEntry = this.iseq[Helper.CatchIdx][0];
  },

  'should have a non-zero stack pointer in the rescue catch entry': function(t) {
    t.assertEqual(3, this.rescueEntry[5]);
  }
});

TestIt('Compiler: begin blocks with empty body', {
  'before all': function(t) {
    this.iseq = compile("begin; end");
    this.body = this.iseq[Helper.BodyIdx];
  },

  'should insert putnil instruction': function(t) {
    var exp = [
      ['putnil'],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with empty rescue body', {
  'before all': function(t) {
    this.iseq = compile("begin     \n\
                           p('hi') \n\
                         rescue    \n\
                         end");

    this.body        = this.iseq[Helper.BodyIdx];
    this.catchTable  = this.iseq[Helper.CatchIdx];
    this.rescueEntry = this.catchTable[0];
    this.rescueISeq  = this.rescueEntry[1];
    this.rescueBody  = this.rescueISeq[Helper.BodyIdx];
  },

  'should insert a putnil instruction in rescue body': function(t) {
    var exp = [
      ['putbuiltin', 'StandardError'],
      ['getdynamic', 0, 0],
      ['send', '===', 1, null],
      ['branchif', 'start-5'],
      ['jump', 'next-8'],
      'start-5',
      ['putnil'],
      ['leave'],
      'next-8',
      ['getdynamic', 0, 0],
      ['throw', 0]
    ];
  
    t.assertEqual(exp, this.rescueBody);
  }
});

