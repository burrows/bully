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

TestIt('Compiler: local variables assignment in blocks', {
  'before all': function(t) {
    this.iseq           = compile("a = 1; Proc.new { a = 2; b = 3; Proc.new { a = 4; b = 5; c = 6; nil } }");
    this.body           = this.iseq[Helper.BodyIdx];
    this.blockiseq1     = this.body[5][3];
    this.blockiseq1Body = this.blockiseq1[Helper.BodyIdx];
    this.blockiseq2     = this.blockiseq1[Helper.BodyIdx][8][3];
    this.blockiseq2Body = this.blockiseq2[Helper.BodyIdx];
  },

  'should use setlocal instruction for locals outside of a block': function(t) {
    t.assertEqual(['putobject', 1], this.body[0]);
    t.assertEqual(['setlocal', 0], this.body[1]);
  },

  'should use setdyanmic instruction with a level greater than 0 for locals set inside the block but defined outside the block': function(t) {
    t.assertEqual(['putobject', 2], this.blockiseq1Body[1]);
    t.assertEqual(['setdynamic', 0, 1], this.blockiseq1Body[2]);

    t.assertEqual(['putobject', 4], this.blockiseq2Body[1]);
    t.assertEqual(['setdynamic', 0, 2], this.blockiseq2Body[2]);
    t.assertEqual(['putobject', 5], this.blockiseq2Body[3]);
    t.assertEqual(['setdynamic', 0, 1], this.blockiseq2Body[4]);
  },

  'should use setdyanmic instruction with the a level of 0 for locals defined inside the block': function(t) {
    t.assertEqual(['putobject', 3], this.blockiseq1Body[3]);
    t.assertEqual(['setdynamic', 0, 0], this.blockiseq1Body[4]);

    t.assertEqual(['putobject', 6], this.blockiseq2Body[5]);
    t.assertEqual(['setdynamic', 0, 0], this.blockiseq2Body[6]);
  }
});

TestIt('Compiler: local variables reference in blocks', {
  'before all': function(t) {
    this.iseq           = compile("a = 1; p a; Proc.new { b = 2; p a; p b; Proc.new { c = 3; p a; p b; p c; nil } }");
    this.body           = this.iseq[Helper.BodyIdx];
    this.blockiseq1     = this.body[9][3];
    this.blockiseq1Body = this.blockiseq1[Helper.BodyIdx];
    this.blockiseq2     = this.blockiseq1[Helper.BodyIdx][14][3];
    this.blockiseq2Body = this.blockiseq2[Helper.BodyIdx];
  },

  'should use getlocal instruction for locals outside of a block': function(t) {
    t.assertEqual(['putself'], this.body[2]);
    t.assertEqual(['getlocal', 0], this.body[3]);
    t.assertEqual(['send', 'p', 1, null], this.body[4]);
  },

  'should use getdyanmic instruction with a level greater than 0 for locals referenced inside the block but defined outside the block': function(t) {
    t.assertEqual(['putself'], this.blockiseq1Body[3]);
    t.assertEqual(['getdynamic', 0, 1], this.blockiseq1Body[4]);
    t.assertEqual(['send', 'p', 1, null], this.blockiseq1Body[5]);

    t.assertEqual(['putself'], this.blockiseq2Body[3]);
    t.assertEqual(['getdynamic', 0, 2], this.blockiseq2Body[4]);
    t.assertEqual(['send', 'p', 1, null], this.blockiseq2Body[5]);
    t.assertEqual(['pop'], this.blockiseq2Body[6]);
    t.assertEqual(['putself'], this.blockiseq2Body[7]);
    t.assertEqual(['getdynamic', 0, 1], this.blockiseq2Body[8]);
    t.assertEqual(['send', 'p', 1, null], this.blockiseq2Body[9]);
    t.assertEqual(['pop'], this.blockiseq2Body[10]);
  },

  'should use getdyanmic instruction with the a level of 0 for locals defined inside the block': function(t) {
    t.assertEqual(['putself'], this.blockiseq1Body[7]);
    t.assertEqual(['getdynamic', 0, 0], this.blockiseq1Body[8]);
    t.assertEqual(['send', 'p', 1, null], this.blockiseq1Body[9]);

    t.assertEqual(['putself'], this.blockiseq2Body[11]);
    t.assertEqual(['getdynamic', 0, 0], this.blockiseq2Body[12]);
    t.assertEqual(['send', 'p', 1, null], this.blockiseq2Body[13]);
  }
});


