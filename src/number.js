Bully.init_number = function() {
  Bully.Number = Bully.define_class('Number');

  // FIXME: undefine new method for Number

  Bully.define_method(Bully.Number, 'to_s', function(self, args) {
    return Bully.str_new(self.toString());
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Number, 'inspect', Bully.Number.m_tbl[Bully.intern('to_s')]);

  Bully.define_method(Bully.Number, '+@', function(self, args) {
    return self;
  }, 0, 0);

  Bully.define_method(Bully.Number, '-@', function(self, args) {
    return -self;
  }, 0, 0);

  Bully.define_method(Bully.Number, '+', function(self, args) {
    return self + args[0];
  }, 1, 1);

  Bully.define_method(Bully.Number, '-', function(self, args) {
    return self - args[0];
  }, 1, 1);

  Bully.define_method(Bully.Number, '*', function(self, args) {
    return self * args[0];
  }, 1, 1);

  Bully.define_method(Bully.Number, '/', function(self, args) {
    return self / args[0];
  }, 1, 1);

  Bully.define_method(Bully.Number, '%', function(self, args) {
    return self % args[0];
  }, 1, 1);

  Bully.define_method(Bully.Number, '<<', function(self, args) {
    return self << args[0];
  }, 1, 1);

  Bully.define_method(Bully.Number, '>>', function(self, args) {
    return self >> args[0];
  }, 1, 1);

  Bully.define_method(Bully.Number, '**', function(self, args) {
    return Math.pow(self, args[0]);
  }, 1, 1);

  Bully.define_method(Bully.Number, '<=>', function(self, args) {
    if (self < args[0]) { return  1; }
    if (self > args[0]) { return -1; }
    return 0;
  }, 1, 1);

  Bully.define_method(Bully.Number, '==', function(self, args) {
    return self === args[0];
  });

  Bully.define_method(Bully.Number, '!=', function(self, args) {
    return self !== args[0];
  });

  Bully.define_method(Bully.Number, '>', function(self, args) {
    return self > args[0];
  });

  Bully.define_method(Bully.Number, '<', function(self, args) {
    return self < args[0];
  });

  Bully.define_method(Bully.Number, 'times', function(self, args, block) {
    var i;

    for (i = 0; i < self; i += 1) {
      Bully.Evaluator._yield(block, [i]);
    }

    return self;
  }, 0, 0);
};

