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

