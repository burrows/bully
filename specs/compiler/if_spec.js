var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: if expressions', {
  'with no else body and no elsif bodies should have the compiled condition and and branchunless instruction to a label after the if body': function(t) {
    var body = compile("if true\np('true')\nend")[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-5'],
          ['putself'],
          ['putstring', 'true'],
          ['send', 'p', 1],
          'label-5',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with an else body and no elsif bodies should have a jump to the end label after the if body': function(t) {
    var body = compile("if true\np('true')\nelse\np('false')\nend")[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-6'],
          ['putself'],
          ['putstring', 'true'],
          ['send', 'p', 1],
          ['jump', 'label-10'],
          'label-6',
          ['putself'],
          ['putstring', 'false'],
          ['send', 'p', 1],
          'label-10',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and no else body should have branchunless instructions for each conditional and jumps to end label for all if bodies except for the last': function(t) {
    var body = compile("if 1\np('1')\nelsif 2\np('2')\nelsif 3\np('3')\nend")[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-6'],
          ['putself'],
          ['putstring', '1'],
          ['send', 'p', 1],
          ['jump', 'label-19'],
          'label-6',
          ['putobject', 2],
          ['branchunless', 'label-13'],
          ['putself'],
          ['putstring', '2'],
          ['send', 'p', 1],
          ['jump', 'label-19'],
          'label-13',
          ['putobject', 3],
          ['branchunless', 'label-19'],
          ['putself'],
          ['putstring', '3'],
          ['send', 'p', 1],
          'label-19',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and else body should have branchunless instructions and jumps to end label for each conditional': function(t) {
    var body = compile("if 1\np('1')\nelsif 2\np('2')\nelsif 3\np('3')\nelse\np('4')\nend")[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-6'],
          ['putself'],
          ['putstring', '1'],
          ['send', 'p', 1],
          ['jump', 'label-24'],
          'label-6',
          ['putobject', 2],
          ['branchunless', 'label-13'],
          ['putself'],
          ['putstring', '2'],
          ['send', 'p', 1],
          ['jump', 'label-24'],
          'label-13',
          ['putobject', 3],
          ['branchunless', 'label-20'],
          ['putself'],
          ['putstring', '3'],
          ['send', 'p', 1],
          ['jump', 'label-24'],
          'label-20',
          ['putself'],
          ['putstring', '4'],
          ['send', 'p', 1],
          'label-24',
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'should add a pop instruction if not used in an outer expression': function(t) {
    var body = compile("x = 1; y = 2; if x\np('x')\nelsif y\np('y')\nelse\np('z')\nend; 1")[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['setlocal', 0],
          ['putobject', 2],
          ['setlocal', 1],
          ['getlocal', 0],
          ['branchunless', 'label-11'],
          ['putself'],
          ['putstring', 'x'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-24'],
          'label-11',
          ['getlocal', 1],
          ['branchunless', 'label-19'],
          ['putself'],
          ['putstring', 'y'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-24'],
          'label-19',
          ['putself'],
          ['putstring', 'z'],
          ['send', 'p', 1],
          ['pop'],
          'label-24',
          ['putobject', 1],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

