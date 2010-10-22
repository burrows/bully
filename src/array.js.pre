Bully.array_new = function(js_array) {
  return Bully.make_object(js_array, Bully.Array);
};

Bully.init_array = function() {
  Bully.Array = Bully.define_class('Array');

  Bully.include_module(Bully.Array, Bully.Enumerable);

  Bully.define_singleton_method(Bully.Array, 'new', function(self, args) {
    return Bully.array_new([]);
  });

  Bully.define_method(Bully.Array, 'size', function(self, args) {
    return self.length;
  });

  Bully.define_method(Bully.Array, 'push', function(self, args) {
    self.push.apply(self, args);
    return self;
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Array, '<<', Bully.Array.m_tbl[Bully.intern('push')]);

  Bully.define_method(Bully.Array, 'pop', function(self, args) {
    return self.pop();
  });

  Bully.define_method(Bully.Array, 'at', function(self, args) {
    return self[args[0]];
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Array, '[]', Bully.Array.m_tbl[Bully.intern('at')]);

  Bully.define_method(Bully.Array, 'insert', function(self, args) {
    self[args[0]] = args[1];
    return self;
  });

  Bully.define_method(Bully.Array, '[]=', function(self, args) {
    self[args[0]] = args[1];
    return args[1];
  });

  Bully.define_method(Bully.Array, 'inspect', function(self, args) {
    var i = 0, elems = [];

    for (i = 0; i < self.length; i += 1) {
      elems.push(send(self[i], 'inspect').data);
    }

    return Bully.str_new('[' + elems.join(', ') + ']');
  });

  Bully.define_method(Bully.Array, 'each', function(self, args, block) {
    var i;

    for (i = 0; i < self.length; i += 1) {
      Bully.Evaluator._yield(block, [self[i]]);
    }

    return self;
  });

  // FIXME: make this take a block
  Bully.define_method(Bully.Array, 'any?', function(self, args, block) {
    return self.length > 0;
  });

  Bully.define_method(Bully.Array, 'join', function(self, args, block) {
    var strings = [], elem, i;

    for (i = 0; i < self.length; i += 1) {
      strings.push(send(self[i], 'to_s').data);
    }

    return Bully.str_new(strings.join(args[0] ? args[0].data : ' '));
  });

  Bully.define_method(Bully.Array, 'include?', function(self, args) {
    var i;

    for (i = 0; i < self.length; i += 1) {
      if (send(self[i], '==', args[0])) {
        return true;
      }
    }

    return false;
  }, 1, 1);

  Bully.define_method(Bully.Array, '==', function(self, args) {
    var other = args[0], i;

    if (!send(other, 'is_a?', Bully.Array)) { return false; }
    if (self.length !== other.length) { return false; }

    for (i = 0; i < self.length; i += 1) {
      if (!send(self[i], '==', other[i])) { return false; }
    }

    return true;
  }, 1, 1);
};

