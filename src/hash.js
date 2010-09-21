Bully.hash_new = function(js_obj) {
  return Bully.make_object(js_obj || {}, Bully.Hash);
};

Bully.hash_set = function(hash, key, value) {
  var key = Bully.dispatch_method(key, 'hash');
  hash[key] = value;
  return value;
};

Bully.hash_get = function(hash, key) {
  var key = Bully.dispatch_method(key, 'hash');
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
};
