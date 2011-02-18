var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: blocks with no args', {
  'before all': function(t) {
    this.iseq = compile("Proc.new { p :hi }");
    this.body = this.iseq[Helper.BodyIdx];
    this.catchTable = this.iseq[Helper.CatchIdx];
    this.blockiseq = this.body[3][3];
    this.blockbody = this.blockiseq[Helper.BodyIdx];
    this.blockCatchTable = this.blockiseq[Helper.CatchIdx];
  },

  'should insert labels before and after compiled method call': function(t) {
    t.assertEqual('block-before-0', this.body[0]);
    t.assertEqual('block-after-4', this.body[4]);
  },

  'should add break catch entry to parent iseq': function(t) {
    t.assertEqual(['break', null, 'block-before-0', 'block-after-4', 'block-after-4', 0], this.catchTable[0]);
  },

  'should pass compiled block iseq as a parameter to the send call': function(t) {
    t.assertEqual(this.body[3][0], 'send');
    t.assertEqual(this.body[3][3][0], 'BullyInstructionSequence');
  },

  'block iseq should have a type of "block"': function(t) {
    t.assertEqual('block', this.blockiseq[Helper.TypeIdx]);
  },

  'block iseq should have a name of "block in <compiled>"': function(t) {
    t.assertEqual('block in <compiled>', this.blockiseq[Helper.NameIdx]);
  },

  'block iseq should have labels at the beginning and end': function(t) {
    var exp = [
      'block-begin-0',
      ['putself'],
      ['putsymbol', 'hi'],
      ['send', 'p', 1, null],
      'block-end-4',
      ['leave']
    ];

    t.assertEqual(exp, this.blockbody);
  },

  'block iseq should have a redo catch entry': function(t) {
    t.assertEqual(['redo', null, 'block-begin-0', 'block-end-4', 'block-begin-0', 0],
                  this.blockCatchTable[0]);
  },

  'block iseq should have a next catch entry': function(t) {
    t.assertEqual(['next', null, 'block-begin-0', 'block-end-4', 'block-end-4', 0],
                  this.blockCatchTable[1]);
  }
});

TestIt('Compiler: blocks with required params', {
  'before all': function(t) {
    this.iseq = compile("Proc.new { |x, y| x + y }");
    this.body = this.iseq[Helper.BodyIdx];
    this.blockiseq = this.body[3][3];
    this.blockbody = this.blockiseq[Helper.BodyIdx];
  },

  'should add param names to block iseq locals': function(t) {
    t.assertEqual(['x', 'y'], this.blockiseq[Helper.LocalsIdx]);
  },

  'should set 2 required args in args descriptor': function(t) {
    t.assertEqual([2, 0, -1, []], this.blockiseq[Helper.ArgsIdx]);
  },

  'should access arguments with getdynamic instructions': function(t) {
    var exp = [
      'block-begin-0',
      ['getdynamic', 0, 0],
      ['getdynamic', 1, 0],
      ['send', '+', 1, null],
      'block-end-4',
      ['leave']
    ];

    t.assertEqual(exp, this.blockbody);
  }
});

TestIt('Compiler: blocks with splat param', {
  'before all': function(t) {
    this.iseq = compile("Proc.new { |*x| x }");
    this.body = this.iseq[Helper.BodyIdx];
    this.blockiseq = this.body[3][3];
    this.blockbody = this.blockiseq[Helper.BodyIdx];
  },

  'should add splat param name to block iseq locals': function(t) {
    t.assertEqual(['x'], this.blockiseq[Helper.LocalsIdx]);
  },

  'should set 0 required args and index of splat arg in args descriptor': function(t) {
    t.assertEqual([0, 0, 0, []], this.blockiseq[Helper.ArgsIdx]);
  },

  'should access argument with getdynamic instructions': function(t) {
    var exp = [
      'block-begin-0',
      ['getdynamic', 0, 0],
      'block-end-2',
      ['leave']
    ];

    t.assertEqual(exp, this.blockbody);
  }
});

TestIt('Compiler: blocks with required params and splat param', {
  'before all': function(t) {
    this.iseq = compile("Proc.new { |x,y,*z| p x; p y; p z; nil }");
    this.body = this.iseq[Helper.BodyIdx];
    this.blockiseq = this.body[3][3];
    this.blockbody = this.blockiseq[Helper.BodyIdx];
  },

  'should add required and splat param names to block iseq locals': function(t) {
    t.assertEqual(['x', 'y', 'z'], this.blockiseq[Helper.LocalsIdx]);
  },

  'should set 2 required args and index of splat arg in args descriptor': function(t) {
    t.assertEqual([2, 0, 2, []], this.blockiseq[Helper.ArgsIdx]);
  },

  'should access argument with getdynamic instructions': function(t) {
    var exp = [
      'block-begin-0',
      ['putself'],
      ['getdynamic', 0, 0],
      ['send', 'p', 1, null],
      ['pop'],
      ['putself'],
      ['getdynamic', 1, 0],
      ['send', 'p', 1, null],
      ['pop'],
      ['putself'],
      ['getdynamic', 2, 0],
      ['send', 'p', 1, null],
      ['pop'],
      ['putnil'],
      'block-end-14',
      ['leave']
    ];

    t.assertEqual(exp, this.blockbody);
  }
});

TestIt('Compiler: nested blocks', {
  'before all': function(t) {
    this.iseq = compile("Proc.new { Proc.new { Proc.new { } } }");
    this.body = this.iseq[Helper.BodyIdx];
    this.blockiseq1 = this.body[3][3];
    this.blockiseq2 = this.blockiseq1[Helper.BodyIdx][4][3];
    this.blockiseq3 = this.blockiseq2[Helper.BodyIdx][4][3];
  },

  'should put level in name if 2 or more levels deep': function(t) {
    t.assertEqual('top', this.iseq[Helper.TypeIdx]);
    t.assertEqual('<compiled>', this.iseq[Helper.NameIdx]);
    t.assertEqual('block', this.blockiseq1[Helper.TypeIdx]);
    t.assertEqual('block in <compiled>', this.blockiseq1[Helper.NameIdx]);
    t.assertEqual('block', this.blockiseq2[Helper.TypeIdx]);
    t.assertEqual('block (2 levels) in <compiled>', this.blockiseq2[Helper.NameIdx]);
    t.assertEqual('block', this.blockiseq3[Helper.TypeIdx]);
    t.assertEqual('block (3 levels) in <compiled>', this.blockiseq3[Helper.NameIdx]);
  }
});

TestIt('Compiler: local variables in blocks', {
});

TestIt('Compiler: local variables in nested blocks', {
});

