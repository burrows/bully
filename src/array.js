Bully.array_new = function(js_array) {
  var a = Bully.make_object(js_array);
  a.klass = Bully.Array;
  return a;
};

Bully.init_array = function() {
  Bully.Array = Bully.define_class('Array');

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

  Bully.define_method(Bully.Array, 'pop', function(self, args) {
    return self.pop();
  });

  Bully.define_method(Bully.Array, 'at', function(self, args) {
    return self[args[0]];
  });

  // FIXME: properly alias this method
  Bully.define_method(Bully.Array, '[]', Bully.Array.m_tbl.at);

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
      elems.push(Bully.dispatch_method(self[i], 'inspect').data);
    }

    return Bully.str_new('[' + elems.join(', ') + ']');
  });
};
