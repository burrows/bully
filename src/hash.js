Bully.hash_new = function() {
  var h = Bully.make_object({}, Bully.Hash);
  Bully.ivar_set(h, '__keys__', []);
  return h;
};

Bully.hash_set = function(hash, key, value) {
  var keys = Bully.ivar_get(hash, '__keys__');

  if (keys.indexOf(key) === -1) { keys.push(key); }

  key = Bully.dispatch_method(key, 'hash');
  hash[key] = value;
  return value;
};

Bully.hash_get = function(hash, key) {
  key = Bully.dispatch_method(key, 'hash');
  return hash[key];
};

Bully.init_hash = function() {
  Bully.Hash = Bully.define_class('Hash');

  Bully.define_singleton_method(Bully.Hash, 'new', function(self, args) {
    return Bully.hash_new();
  });

  Bully.define_method(Bully.Hash, '[]=', function(self, args) {
    return Bully.hash_set(self, args[0], args[1]);
  }, 2, 2);

  Bully.define_method(Bully.Hash, '[]', function(self, args) {
    return Bully.hash_get(self, args[0]);
  }, 1, 1);

  Bully.define_method(Bully.Hash, 'keys', function(self, args) {
    return Bully.array_new(Bully.ivar_get(self, '__keys__'));
  });

  Bully.define_method(Bully.Hash, 'values', function(self, args) {
    var keys = Bully.ivar_get(self, '__keys__'), values = [], i;

    for (i = 0; i < keys.length; i += 1) {
      values.push(Bully.hash_get(self, keys[i]));
    }

    return Bully.array_new(values);
  });

  Bully.define_method(Bully.Hash, 'inspect', function(self, args) {
    var keys = Bully.ivar_get(self, '__keys__'), elems = [], i, s;

    for (i = 0; i < keys.length; i += 1) {
      s = Bully.dispatch_method(keys[i], 'inspect').data + ' => ';
      s += Bully.dispatch_method(Bully.hash_get(self, keys[i]), 'inspect').data;
      elems.push(s);
    }

    return Bully.str_new('{' + elems.join(', ') + '}');
  });
};
