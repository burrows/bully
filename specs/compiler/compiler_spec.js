var TestIt      = require('../../vendor/test_it/src/test_it').TestIt,
    Bully       = require('../../src/bully').Bully,
    NameIdx     = 1,
    TypeIdx     = 2,
    MaxStackIdx = 3,
    LocalsIdx   = 4,
    ArgsIdx     = 5,
    CatchIdx    = 6,
    BodyIdx     = 7;

function compile(src) {
  var ast = Bully.parser.parse((new Bully.Lexer()).tokenize(src));
  return Bully.Compiler.compile(ast);
}

TestIt('Compiler: ISeq', {
  'should include "BullyInstructionSequence" at index 0': function(t) {
    t.assertEqual('BullyInstructionSequence', compile('1')[0]);
  },

  'should include the name at index 1': function(t) {
    t.assertEqual('<compiled>', compile('1')[NameIdx]);
  },

  'should include the type at index 2': function(t) {
    t.assertEqual('top', compile('1')[TypeIdx]);
  },

  'should include the maximum stack size at index 3': function(t) {
    t.assertEqual(2, compile('1 + 1')[MaxStackIdx]);
    t.assertEqual(4, compile('foo(1,2,3)')[MaxStackIdx]);
  },

  'should include an array of local variable names at index 4': function(t) {
    t.assertEqual(['a', 'b', 'c'], compile('a = 1; b = 2; c = 3')[LocalsIdx]);
  },

  'should include the arguments descriptor array at index 5': function(t) {
    t.assertEqual([0,0,-1,[]], compile('1')[ArgsIdx]);
  },

  'should include the catch table at index 6': function(t) {
    t.assertEqual([], compile('1')[CatchIdx]);
  },

  'should include the body at index 7': function(t) {
    var exp = [
      ['putself'],
      ['putobject', 1],
      ['send', 'foo', 1],
      ['leave']
    ];
    t.assertEqual(exp, compile('foo(1)')[BodyIdx]);
  }
});

TestIt('Compiler: local variable assignments', {
  "should add an entry to the iseq's locals table": function(t) {
    var iseq = compile('foo = 1; bar = 2');

    t.assertEqual(['foo', 'bar'], iseq[LocalsIdx]);
  },

  'should add setlocal instruction with the correct index': function(t) {
    var body = compile('foo = 1; bar = 2; foo = 3')[BodyIdx],
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

TestIt('Compiler: number literals', {
  'should add no instruction if literal is not used in an expression': function(t) {
    var body = compile('1; 2')[BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add putobject instruction if literal is used in an expression': function(t) {
    var body = compile('1.1 + 2.78')[BodyIdx],
        exp  = [
          ['putobject', 1.1],
          ['putobject', 2.78],
          ['send', '+', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: string literals', {
  'should add no instruction if string literal is not used in an expression': function(t) {
    var body = compile('"foo"; 2')[BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add putstring instruction if string literal is used in an expression': function(t) {
    var body = compile('p "foo"')[BodyIdx],
        exp  = [
          ['putself'],
          ['putstring', 'foo'],
          ['send', 'p', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: boolean literals', {
  'should add no instruction if literal is not used in an expression': function(t) {
    var body = compile('true; false; 2')[BodyIdx],
        exp  = [
          ['putobject', 2],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add putobject instruction if literal is used in an expression': function(t) {
    var body = compile('x = true; y = false')[BodyIdx],
        exp  = [
          ['putobject', true],
          ['setlocal', 0],
          ['putobject', false],
          ['setlocal', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: method calls', {
  'should add getlocal instruction if there is no expression, no args, and a local variable with the given name is defined': function(t) {
    var body = compile('a = 1; a')[BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['getlocal', 0],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should compile a method call if there is a local variable declared with the same name but there are arguments': function(t) {
    var body = compile('a = 1; a(2)')[BodyIdx],
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
    var body = compile('a = 1; a.foo')[BodyIdx],
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
    var body = compile('foo(2)')[BodyIdx],
        exp = [
          ['putself'],
          ['putobject', 2],
          ['send', 'foo', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should give the number of arguments to the send instruction': function(t) {
    var body = compile('foo(1,2,3,4,5)')[BodyIdx],
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
    var body = compile('foo(); 1')[BodyIdx],
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
    var body = compile('x = foo(); 1')[BodyIdx],
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
    var body = compile('foo()')[BodyIdx],
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
    var body = compile('def foo; end')[BodyIdx];

    t.assertEqual(['putcurrentmodule'], body[0]);
  },

  'should use add the definemethod instruction with the method name and false to indicate its not a singleton method': function(t) {
    var body = compile('def foo; end')[BodyIdx];

    t.assertEqual(['definemethod', 'foo', false], body[2]);
  },

  'should add the compiled method body using putiseq': function(t) {
    var body = compile('def foo; end')[BodyIdx];

    t.assertEqual('putiseq', body[1][0]);
  },

  'should compile the method body into a new iseq of type "method" and the name of the method': function(t) {
    var body = compile('def foo; 1; end')[BodyIdx],
        iseq = body[1][1],
        methodbody = iseq[BodyIdx],
        exp = [
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual('BullyInstructionSequence', iseq[0]);
    t.assertEqual('foo', iseq[NameIdx]);
    t.assertEqual('method', iseq[TypeIdx]);

    t.assertEqual(exp, methodbody);
  },

  'should add putnil instruction if definition is used in an expression': function(t) {
    var body = compile('x = def foo; end')[BodyIdx],
        len = body.length;

    t.assertEqual('definemethod',  body[len - 4][0]);
    t.assertEqual(['putnil'],      body[len - 3]);
    t.assertEqual(['setlocal', 0], body[len - 2]);
    t.assertEqual(['leave'],       body[len - 1]);
  }
});

TestIt('Compiler: non-singleton method definitions with params', {
  'should add param names to locals': function(t) {
    var body = compile('def foo(a, b, c = 1, *d); end')[BodyIdx],
        iseq = body[1][1];

    t.assertEqual(['a', 'b', 'c', 'd'], iseq[LocalsIdx]);
  },

  'should set number of required args at index 0 of arguments descriptor': function(t) {
    var args = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[BodyIdx][1][1][ArgsIdx];

    t.assertEqual(3, args[0]);
  },

  'should set number of optional args at index 1 of arguments descriptor': function(t) {
    var args = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[BodyIdx][1][1][ArgsIdx];

    t.assertEqual(2, args[1]);
  },

  'should set index of splat param at index 2 of arguments descriptor': function(t) {
    var args1 = compile('def foo(a, b, c, d = 1, e = 2, *f); end')[BodyIdx][1][1][ArgsIdx],
        args2 = compile('def foo(a,b,c=1); end')[BodyIdx][1][1][ArgsIdx];

    t.assertEqual(5, args1[2]);
    t.assertEqual(-1, args2[2]);
  },

  'should add optional argument labels and body start label at index 3 of arguments descriptor': function(t) {
    var args = compile('def foo(a=1,b=2); end')[BodyIdx][1][1][ArgsIdx];

    t.assertEqual(['optarg-a-1', 'optarg-b-2', 'bodystart-3'], args[3]);
  },

  'should compile default values for optional arugments at beginning of body with appropriate labels': function(t) {
    var methodbody = compile('def foo(a=1,b=2); a + b; end')[BodyIdx][1][1][BodyIdx];
        exp = [
          'optarg-a-1',
          ['putobject', 1],
          ['setlocal', 0],
          'optarg-b-2',
          ['putobject', 2],
          ['setlocal', 1],
          'bodystart-3',
          ['getlocal', 0],
          ['getlocal', 1],
          ['send', '+', 1],
          ['leave']
        ];

    t.assertEqual(exp, methodbody);
  }
});

TestIt('Compiler: constant references', {
  'with global scope operator should add putbuiltin instruction for Object': function(t) {
    var body = compile('::Foo')[BodyIdx],
        exp  = [
          ['putbuiltin', 'Object'],
          ['getconstant', 'Foo'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'without global scope operator should add putnil instruction to indicate lexical lookup': function(t) {
    var body = compile('Foo')[BodyIdx],
        exp  = [
          ['putnil'],
          ['getconstant', 'Foo'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'for scoped constants should add getconstant instructions for each name': function(t) {
    var body = compile('Foo::Bar::Baz')[BodyIdx],
        exp  = [
          ['putnil'],
          ['getconstant', 'Foo'],
          ['getconstant', 'Bar'],
          ['getconstant', 'Baz'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add pop instruction if constant is not used in an expression': function(t) {
    var body = compile('Foo; 1')[BodyIdx],
        exp  = [
          ['putnil'],
          ['getconstant', 'Foo'],
          ['pop'],
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: if expressions', {
  'with no else body and no elsif bodies should have the compiled condition and and branchunless instruction to a label after the if body': function(t) {
    var body = compile("if true\np('true')\nend")[BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-1'],
          ['putself'],
          ['putstring', 'true'],
          ['send', 'p', 1],
          'label-1',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with an else body and no elsif bodies should have a jump to the end label after the if body': function(t) {
    var body = compile("if true\np('true')\nelse\np('false')\nend")[BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-1'],
          ['putself'],
          ['putstring', 'true'],
          ['send', 'p', 1],
          ['jump', 'label-2'],
          'label-1',
          ['putself'],
          ['putstring', 'false'],
          ['send', 'p', 1],
          'label-2',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and no else body should have branchunless instructions for each conditional and jumps to end label for all if bodies except for the last': function(t) {
    var body = compile("if 1\np('1')\nelsif 2\np('2')\nelsif 3\np('3')\nend")[BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-1'],
          ['putself'],
          ['putstring', '1'],
          ['send', 'p', 1],
          ['jump', 'label-3'],
          'label-1',
          ['putobject', 2],
          ['branchunless', 'label-2'],
          ['putself'],
          ['putstring', '2'],
          ['send', 'p', 1],
          ['jump', 'label-3'],
          'label-2',
          ['putobject', 3],
          ['branchunless', 'label-3'],
          ['putself'],
          ['putstring', '3'],
          ['send', 'p', 1],
          'label-3',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and else body should have branchunless instructions and jumps to end label for each conditional': function(t) {
    var body = compile("if 1\np('1')\nelsif 2\np('2')\nelsif 3\np('3')\nelse\np('4')\nend")[BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-1'],
          ['putself'],
          ['putstring', '1'],
          ['send', 'p', 1],
          ['jump', 'label-4'],
          'label-1',
          ['putobject', 2],
          ['branchunless', 'label-2'],
          ['putself'],
          ['putstring', '2'],
          ['send', 'p', 1],
          ['jump', 'label-4'],
          'label-2',
          ['putobject', 3],
          ['branchunless', 'label-3'],
          ['putself'],
          ['putstring', '3'],
          ['send', 'p', 1],
          ['jump', 'label-4'],
          'label-3',
          ['putself'],
          ['putstring', '4'],
          ['send', 'p', 1],
          'label-4',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add a pop instruction if not used in an outer expression': function(t) {
    var body = compile("x = 1; y = 2; if x\np('x')\nelsif y\np('y')\nelse\np('z')\nend; 1")[BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['putobject', 2],
          ['setlocal', 1],
          ['getlocal', 0],
          ['branchunless', 'label-1'],
          ['putself'],
          ['putstring', 'x'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-3'],
          'label-1',
          ['getlocal', 1],
          ['branchunless', 'label-2'],
          ['putself'],
          ['putstring', 'y'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-3'],
          'label-2',
          ['putself'],
          ['putstring', 'z'],
          ['send', 'p', 1],
          ['pop'],
          'label-3',
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: begin blocks with no rescues, ensures, or else', {
  'should simply compile the body': function(t) {
    var body = compile("begin\n3 * 2\nend")[BodyIdx],
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

    this.body = this.iseq[BodyIdx];
    //this.rescueCatchEntry = this.seq[CatchIdx][0];
  },

  'should compile body and pop resulting value': function(t) {
    var exp = [
      'label-1',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      'label-2',
      'label-3',
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

    this.body = this.iseq[BodyIdx];
    //this.rescueCatchEntry = this.seq[CatchIdx][0];
  },

  'should compile body and leave resulting value on stack': function(t) {
    var exp = [
      'label-1',
      ['putself'],
      ['putstring', 'hi'],
      ['send', 'p', 1],
      'label-2',
      'label-3',
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});

TestIt('Compiler: begin blocks with only else clause and unused value', {
  'before all': function(t) {
    this.iseq = compile("begin      \n\
                          p('hi')   \n\
                         else       \n\
                          p('else') \n\
                         end; 1");

    this.body = this.iseq[BodyIdx];
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
    this.iseq = compile("begin      \n\
                          p('hi')   \n\
                         else       \n\
                          p('else') \n\
                         end");

    this.body = this.iseq[BodyIdx];
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
      ['leave']
    ];

    t.assertEqual(exp, this.body);
  }
});


// rescue only
// else only
// only ensure
// rescue and else
// rescue and ensure
// else and ensure
// rescue, else, and ensure
//
// each of the above when result is used and when not


//TestIt('Compiler: begin blocks with no rescues, ensures, or else', {
//  'should simply compile the body': function(t) {
//    var body = compile("begin\n3 * 2\nend")[BodyIdx],
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
//    this.body = this.iseq[BodyIdx];
//    this.rescueEntry = this.iseq[CatchIdx][0];
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
//    t.assertEqual('rescue', this.rescueIseq[TypeIdx]);
//    t.assertEqual('rescue in <compiled>', this.rescueIseq[NameIdx]);
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
//    t.assertEqual(['#$!'], this.rescueIseq[LocalsIdx]);
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
//    t.assertEqual(exp, this.rescueIseq[BodyIdx]);
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
//    this.body = this.iseq[BodyIdx];
//    this.rescueEntry = this.iseq[CatchIdx][0];
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
//    t.assertEqual(exp, this.rescueIseq[BodyIdx]);
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
//    this.body = this.iseq[BodyIdx];
//    this.rescueEntry = this.iseq[CatchIdx][0];
//    this.rescueIseq  = this.rescueEntry[1];
//  },
//
//  "should add the variable name to the enclosing iseq's locals array": function(t) {
//    t.assertEqual(['e'], this.iseq[LocalsIdx]);
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
//    t.assertEqual(exp, this.rescueIseq[BodyIdx]);
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
//    this.body = this.iseq[BodyIdx];
//    this.rescueEntry = this.iseq[CatchIdx][0];
//  },
//
//  'should have a non-zero stack pointer in the rescue catch entry': function(t) {
//    t.assertEqual(3, this.rescueEntry[5]);
//  }
//});
//
