var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: begin blocks with no rescues, ensures, or else', {
  'should simply compile the body': function(t) {
    var body = compile("begin\n3 * 2\nend")[Helper.BodyIdx],
        exp  = [
          ['putobject', 3],
          ['putobject', 2],
          ['send', '*', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: begin blocks with only rescue clause with unused value', {
  'before all': function(t) {
    this.iseq = compile("begin         \n\
                           p('hi')     \n\
                         rescue        \n\
                           p('rescue') \n\
                         end; 1");

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile body and pop resulting value': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      'rstop-4',
      'rcont-5',
      ['pop'],
      ['putobject', 1],
      ['leave'],
    ];

    t.assertEqual(exp, this.body);
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
      ['send', 'p', 1],
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

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile else body into body and pop resulting value': function(t) {
    var exp = [
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
      ['pop'],
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
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
      ['send', 'p', 1],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
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

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure body into body with start, stop, continue labels and pop resulting value': function(t) {
    var exp = [
      'estart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      ['pop'],
      'estop-5',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
      ['pop'],
      'econt-10',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
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
      ['send', 'p', 1],
      'estop-4',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
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
      ['send', 'p', 1],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
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
      ['send', 'p', 1],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
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

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure body into body with start, stop, continue rescue and ensure labels and pop resulting value': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      'rstop-4',
      'rcont-5',
      ['pop'],
      'estop-7',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
      ['pop'],
      'econt-12',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
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
      ['send', 'p', 1],
      'rstop-4',
      'rcont-5',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
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

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure and else bodies into body with start, stop, continue rescue and ensure labels and pop resulting value': function(t) {
    var exp = [
      'rstart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
      'rcont-9',
      ['pop'],
      'estop-11',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
      ['pop'],
      'econt-16',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
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
      ['send', 'p', 1],
      'rstop-4',
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
      'rcont-9',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
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

    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile ensure and else bodies into body with start, stop, continue ensure labels and pop resulting value': function(t) {
    var exp = [
      'estart-0',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
      ['pop'],
      'estop-9',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
      ['pop'],
      'econt-14',
      ['putobject', 1],
      ['leave']
    ];

    t.assertEqual(exp, this.body);
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
      ['send', 'p', 1],
      ['pop'],
      ['putself'],
      ['putstring', 'else'],
      ['send', 'p', 1],
      'estop-8',
      ['putself'],
      ['putstring', 'ensure'],
      ['send', 'p', 1],
      ['pop'],
      'econt-13',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

//TestIt('Compiler: begin blocks with no rescues, ensures, or else', {
//  'should simply compile the body': function(t) {
//    var body = compile("begin\n3 * 2\nend")[Helper.BodyIdx],
//        exp  = [
//          ['putobject', 3],
//          ['putobject', 2],
//          ['send', '*', 1],
//          ['leave']
//        ];
//
//    t.assertEqual(exp, body);
//  }
//});
//
//TestIt('Compiler: begin blocks with with a bare rescue clause', {
//  'before all': function(t) {
//    this.iseq = compile("begin     \n\
//                          p('hi')  \n\
//                        rescue     \n\
//                          p('bye') \n\
//                        end");
//    this.body = this.iseq[Helper.BodyIdx];
//    this.rescueEntry = this.iseq[Helper.CatchIdx][0];
//    this.rescueIseq  = this.rescueEntry[1];
//  },
//
//  'should insert start, end, and continue labels around compiled begin body': function(t) {
//    var exp = [
//      'begin-start-1',
//      ['putself'],
//      ['putstring', 'hi'],
//      ['send', 'p', 1],
//      'begin-end-2',
//      'begin-after-3',
//      ['leave']
//    ]
//
//    t.assertEqual(exp, this.body);
//  },
//
//  'should insert a rescue catch entry with type "rescue" and name "rescue in <compiled>"': function(t) {
//    t.assertEqual('rescue', this.rescueEntry[0]);
//  },
//
//  "rescue catch entry's iseq should have type 'rescue' and name 'rescue in <compiled>'": function(t) {
//    t.assertEqual('rescue', this.rescueIseq[Helper.TypeIdx]);
//    t.assertEqual('rescue in <compiled>', this.rescueIseq[Helper.NameIdx]);
//  },
//
//  "rescue catch entry should have start, end, and continue labels set": function(t) {
//    t.assertEqual('begin-start-1', this.rescueEntry[2]);
//    t.assertEqual('begin-end-2', this.rescueEntry[3]);
//    t.assertEqual('begin-after-3', this.rescueEntry[4]);
//  },
//
//  "rescue catch entry should have stack pointer set to 0": function(t) {
//    t.assertEqual(0, this.rescueEntry[5]);
//  },
//
//  "rescue catch entry's iseq should have a local variable called '#$!' at index 0": function(t) {
//    t.assertEqual(['#$!'], this.rescueIseq[Helper.LocalsIdx]);
//  },
//
//  "rescue catch entry's iseq should contain check for StandardError": function(t) {
//    var exp = [
//      ['putbuiltin', 'StandardError'],
//      ['getdynamic', 0, 0],
//      ['send', '===', 1],
//      ['branchunless', 'rescue-body-end-2'],
//      'rescue-body-start-1',
//      ['putself'],
//      ['putstring', 'bye'],
//      ['send', 'p', 1],
//      ['leave'],
//      'rescue-body-end-2',
//      ['getdynamic', 0, 0],
//      ['throw']
//    ];
//
//    t.assertEqual(exp, this.rescueIseq[Helper.BodyIdx]);
//  }
//});
//
//TestIt('Compiler: begin blocks with with qualified rescue clauses', {
//  'before all': function(t) {
//    this.iseq = compile("begin                \n\
//                          p('hi')             \n\
//                        rescue Error1, Error2 \n\
//                          p('1 or 2')         \n\
//                        rescue Error3         \n\
//                          p('3')              \n\
//                        end");
//    this.body = this.iseq[Helper.BodyIdx];
//    this.rescueEntry = this.iseq[Helper.CatchIdx][0];
//    this.rescueIseq  = this.rescueEntry[1];
//  },
//
//  'should contain checks for each given exception class': function(t) {
//    var exp = [
//      ['putnil'],
//      ['getconstant', 'Error1'],
//      ['getdynamic', 0, 0],
//      ['send', '===', 1],
//      ['branchif', 'rescue-body-start-1'],
//      ['putnil'],
//      ['getconstant', 'Error2'],
//      ['getdynamic', 0, 0],
//      ['send', '===', 1],
//      ['branchunless', 'rescue-body-end-2'],
//      'rescue-body-start-1',
//      ['putself'],
//      ['putstring', '1 or 2'],
//      ['send', 'p', 1],
//      ['leave'],
//      'rescue-body-end-2',
//      ['putnil'],
//      ['getconstant', 'Error3'],
//      ['getdynamic', 0, 0],
//      ['send', '===', 1],
//      ['branchunless', 'rescue-body-end-4'],
//      'rescue-body-start-3',
//      ['putself'],
//      ['putstring', '3'],
//      ['send', 'p', 1],
//      ['leave'],
//      'rescue-body-end-4',
//      ['getdynamic', 0, 0],
//      ['throw']
//    ];
//
//    t.assertEqual(exp, this.rescueIseq[Helper.BodyIdx]);
//  }
//});
//
//TestIt('Compiler: begin blocks with with qualified rescue clauses with variable names', {
//  'before all': function(t) {
//    this.iseq = compile("begin            \n\
//                          p('hi')         \n\
//                        rescue Error => e \n\
//                          p(e)            \n\
//                        end");
//    this.body = this.iseq[Helper.BodyIdx];
//    this.rescueEntry = this.iseq[Helper.CatchIdx][0];
//    this.rescueIseq  = this.rescueEntry[1];
//  },
//
//  "should add the variable name to the enclosing iseq's locals array": function(t) {
//    t.assertEqual(['e'], this.iseq[Helper.LocalsIdx]);
//  },
//
//  'should assign the exception object to the given variable name': function(t) {
//    var exp = [
//      ['putnil'],
//      ['getconstant', 'Error'],
//      ['getdynamic', 0, 0],
//      ['send', '===', 1],
//      ['branchunless', 'rescue-body-end-2'],
//      'rescue-body-start-1',
//      ['getdynamic', 0, 0],
//      ['setlocal', 0],
//      ['putself'],
//      ['getlocal', 0],
//      ['send', 'p', 1],
//      ['leave'],
//      'rescue-body-end-2',
//      ['getdynamic', 0, 0],
//      ['throw']
//    ];
//
//    t.assertEqual(exp, this.rescueIseq[Helper.BodyIdx]);
//  }
//});
//
//TestIt('Compiler: begin blocks that appear in an expression', {
//  'before all': function(t) {
//    this.iseq = compile("foo(1, 2, begin     \n\
//                                     p('hi')  \n\
//                                   rescue     \n\
//                                     p('bye') \n\
//                                   end)");
//    this.body = this.iseq[Helper.BodyIdx];
//    this.rescueEntry = this.iseq[Helper.CatchIdx][0];
//  },
//
//  'should have a non-zero stack pointer in the rescue catch entry': function(t) {
//    t.assertEqual(3, this.rescueEntry[5]);
//  }
//});
//
