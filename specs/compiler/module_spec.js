var Helper  = require(__dirname + '/helper').Helper,
    TestIt  = Helper.TestIt,
    Bully   = Helper.Bully,
    compile = Helper.compile;

TestIt('Compiler: class definition with bare constant name and no superclass', {
  'before all': function(t) {
    this.iseq = compile("class Foo; 7; end");
    this.body = this.iseq[Helper.BodyIdx];
  },

  'should insert a putcurrentmodule instruction for the class base': function(t) {
    t.assertEqual(['putcurrentmodule'], this.body[0]);
  },
  
  'should insert a putnil instruction for the superclass': function(t) {
    t.assertEqual(['putnil'], this.body[1]);
  },
  
  'should insert a defineclass instruction with the class name and type 0': function(t) {
    t.assertEqual('defineclass', this.body[2][0]);
    t.assertEqual('Foo', this.body[2][1]);
    t.assertEqual(0, this.body[2][3]);
  },

  'should insert an iseq for the class body as the second argument to defineclass': function(t) {
    var classbody = this.body[2][2],
        exp = [
          ['putobject', 7],
          ['leave'],
        ];

    t.assertEqual('BullyInstructionSequence', classbody[0]);
    t.assertEqual('class', classbody[Helper.TypeIdx]);
    t.assertEqual('<class:Foo>', classbody[Helper.NameIdx]);
    t.assertEqual(exp, classbody[Helper.BodyIdx]);
  }
});

TestIt('Compiler: class definition with superclass', {
  'before all': function(t) {
    this.iseq = compile("class Foo < Bar::Baz; 9; end");
    this.body = this.iseq[Helper.BodyIdx];
  },

  'should insert a putcurrentmodule instruction for the class base': function(t) {
    t.assertEqual(['putcurrentmodule'], this.body[0]);
  },
  
  'should compile the superclass constant reference': function(t) {
    t.assertEqual(['putnil'], this.body[1]);
    t.assertEqual(['getconstant', 'Bar'], this.body[2]);
    t.assertEqual(['getconstant', 'Baz'], this.body[3]);
    t.assertEqual('defineclass', this.body[4][0]);
  }
});


TestIt('Compiler: class definition with nested constant name', {
  'before all': function(t) {
    this.iseq = compile("class Foo::Bar::Baz; 9; end");
    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile a constant reference for the class base': function(t) {
    t.assertEqual(['putnil'], this.body[0]);
    t.assertEqual(['getconstant', 'Foo'], this.body[1]);
    t.assertEqual(['getconstant', 'Bar'], this.body[2]);
    t.assertEqual(['putnil'], this.body[3]);
    t.assertEqual('defineclass', this.body[4][0]);
    t.assertEqual('Baz', this.body[4][1]);
  }
});

TestIt('Compiler: class definition with globally scoped constant name', {
  'that is not nested should compile a global constant reference for the class base': function(t) {
    var iseq = compile("class ::Foo; 9; end"),
        body = iseq[Helper.BodyIdx];

    t.assertEqual(['putbuiltin', 'Object'], body[0]);
    t.assertEqual(['putnil'], body[1]);
    t.assertEqual('defineclass', body[2][0]);
    t.assertEqual('Foo', body[2][1]);
  },

  'that is nested should compile a global constant reference for the class base': function(t) {
    var iseq = compile("class ::Foo::Bar::Baz; 9; end"),
        body = iseq[Helper.BodyIdx];

    t.assertEqual(['putbuiltin', 'Object'], body[0]);
    t.assertEqual(['getconstant', 'Foo'], body[1]);
    t.assertEqual(['getconstant', 'Bar'], body[2]);
    t.assertEqual(['putnil'], body[3]);
    t.assertEqual('defineclass', body[4][0]);
    t.assertEqual('Baz', body[4][1]);
  }
});

TestIt('Compiler: singleton class definitions', {
  'before all': function(t) {
    this.iseq = compile("class << Foo; 3; end");
    this.body = this.iseq[Helper.BodyIdx];
  },

  'should compile the object reference as the class base': function(t) {
    t.assertEqual(['putnil'], this.body[0]);
    t.assertEqual(['getconstant', 'Foo'], this.body[1]);
  },
  
  'should insert a putnil instruction for the superclass': function(t) {
    t.assertEqual(['putnil'], this.body[2]);
  },
  
  'should insert a defineclass instruction with a class name of "singletonclass" and type 1': function(t) {
    t.assertEqual('defineclass', this.body[3][0]);
    t.assertEqual('singletonclass', this.body[3][1]);
    t.assertEqual(1, this.body[3][3]);
  },

  'should insert an iseq for the class body as the second argument to defineclass': function(t) {
    var classbody = this.body[3][2],
        exp = [
          ['putobject', 3],
          ['leave'],
        ];

    t.assertEqual('BullyInstructionSequence', classbody[0]);
    t.assertEqual('singletonclass', classbody[Helper.TypeIdx]);
    t.assertEqual('singletonclass', classbody[Helper.NameIdx]);
    t.assertEqual(exp, classbody[Helper.BodyIdx]);
  }
});

TestIt('Compiler: module definitions', {
  //'should insert defineclass instruction with type 2 and nil as the superclass': function(t) {
  //  var body = compile('module Foo; end'),
  //      exp  = [
  //        ['putcurrentmodule'],
  //        ['putnil'],
  //        ['defineclass', 'Foo', 2],
  //      ];

  //  t.assertEqual(exp, body);
  //}
});
