var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: if expressions not used in a larger expression', {
  'with no else body and no elsif bodies should have the compiled condition and and branchunless instruction to a label after the if body': function(t) {
    var body = compile("if true\np('true')\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-6'],
          ['putself'],
          ['putstring', 'true'],
          ['send', 'p', 1],
          ['pop'],
          'label-6',
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with an else body and no elsif bodies should have a jump to the end label after the if body': function(t) {
    var body = compile("if true\np('true')\nelse\np('false')\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-7'],
          ['putself'],
          ['putstring', 'true'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-12'],
          'label-7',
          ['putself'],
          ['putstring', 'false'],
          ['send', 'p', 1],
          ['pop'],
          'label-12',
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and no else body should have branchunless instructions for each conditional and jumps to end label for all if bodies except for the last': function(t) {
    var body = compile("if 1\np('1')\nelsif 2\np('2')\nelsif 3\np('3')\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-7'],
          ['putself'],
          ['putstring', '1'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-22'],
          'label-7',
          ['putobject', 2],
          ['branchunless', 'label-15'],
          ['putself'],
          ['putstring', '2'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-22'],
          'label-15',
          ['putobject', 3],
          ['branchunless', 'label-22'],
          ['putself'],
          ['putstring', '3'],
          ['send', 'p', 1],
          ['pop'],
          'label-22',
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and else body should have branchunless instructions and jumps to end label for each conditional': function(t) {
    var body = compile("if 1\np('1')\nelsif 2\np('2')\nelsif 3\np('3')\nelse\np('4')\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-7'],
          ['putself'],
          ['putstring', '1'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-28'],
          'label-7',
          ['putobject', 2],
          ['branchunless', 'label-15'],
          ['putself'],
          ['putstring', '2'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-28'],
          'label-15',
          ['putobject', 3],
          ['branchunless', 'label-23'],
          ['putself'],
          ['putstring', '3'],
          ['send', 'p', 1],
          ['pop'],
          ['jump', 'label-28'],
          'label-23',
          ['putself'],
          ['putstring', '4'],
          ['send', 'p', 1],
          ['pop'],
          'label-28',
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

TestIt('Compiler: if expressions used in a larger expression', {
  'with no else body and no elsif bodies should leave values on the stack and insert a putnil instruction for the else case': function(t) {
    var body = compile("x = if true\n9\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-4'],
          ['putobject', 9],
          ['jump', 'label-6'],
          'label-4',
          ['putnil'],
          'label-6',
          ['setlocal', 0],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with an else body and no elsif bodies should leave each value on the stack': function(t) {
    var body = compile("x = if true\n1\nelse\n2\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', true],
          ['branchunless', 'label-4'],
          ['putobject', 1],
          ['jump', 'label-6'],
          'label-4',
          ['putobject', 2],
          'label-6',
          ['setlocal', 0],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and no else body should leave each value on the stack and insert putnil instruction for else case': function(t) {
    var body = compile("x = if 1\n1\nelsif 2\n2\nelsif 3\n3\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-4'],
          ['putobject', 1],
          ['jump', 'label-16'],
          'label-4',
          ['putobject', 2],
          ['branchunless', 'label-9'],
          ['putobject', 2],
          ['jump', 'label-16'],
          'label-9',
          ['putobject', 3],
          ['branchunless', 'label-14'],
          ['putobject', 3],
          ['jump', 'label-16'],
          'label-14',
          ['putnil'],
          'label-16',
          ['setlocal', 0],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  },

  'with elsif bodies and else body should leave all values on the stack': function(t) {
    var body = compile("x = if 1\n1\nelsif 2\n2\nelsif 3\n3\nelse\n4\nend; nil")[Helper.BodyIdx],
        exp  = [
          ['putobject', 1],
          ['branchunless', 'label-4'],
          ['putobject', 1],
          ['jump', 'label-16'],
          'label-4',
          ['putobject', 2],
          ['branchunless', 'label-9'],
          ['putobject', 2],
          ['jump', 'label-16'],
          'label-9',
          ['putobject', 3],
          ['branchunless', 'label-14'],
          ['putobject', 3],
          ['jump', 'label-16'],
          'label-14',
          ['putobject', 4],
          'label-16',
          ['setlocal', 0],
          ['putnil'],
          ['leave']
        ];

    t.assertEqual(exp, body);
  }
});

